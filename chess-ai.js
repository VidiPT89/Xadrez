/* ==================== Chess AI — runs inside a Web Worker ==================== */
importScripts("chess-engine.js?v=20260709");

const MATE_SCORE = 1000000;

// Piece-square tables, from White's perspective (row 0 = rank 8 ... row 7 = rank 1).
const PST = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  r: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
};

function evaluate(game) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (!p) continue;
      const value = PIECE_VALUES[p.type];
      const pstRow = p.color === "w" ? r : 7 - r;
      const pstVal = PST[p.type][pstRow][c];
      const sign = p.color === "w" ? 1 : -1;
      score += sign * (value + pstVal);
    }
  }
  return score;
}

function orderMoves(moves) {
  return moves.slice().sort((a, b) => {
    const scoreOf = (m) => {
      let s = 0;
      if (m.capture) s += 1000;
      if (m.promotion) s += 900;
      return s;
    };
    return scoreOf(b) - scoreOf(a);
  });
}

function quiescence(game, alpha, beta, colorSign, qdepth) {
  const standPat = colorSign * evaluate(game);
  if (qdepth <= 0) return standPat;
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const moves = game.allLegalMoves(game.turn).filter((m) => m.capture || m.promotion);
  const ordered = orderMoves(moves);
  for (const move of ordered) {
    const child = game.clone();
    child.makeMove({ from: move.from, to: move.to, promotion: move.promotion || null });
    const score = -quiescence(child, -beta, -alpha, -colorSign, qdepth - 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(game, depth, alpha, beta, colorSign, useQuiescence, deadline) {
  if (game.isGameOver()) {
    const status = game.gameStatusText();
    if (status.key === "checkmate") return -MATE_SCORE - depth;
    return 0;
  }
  if (depth === 0) {
    return useQuiescence ? quiescence(game, alpha, beta, colorSign, 4) : colorSign * evaluate(game);
  }
  if (deadline && performance.now() > deadline) {
    return colorSign * evaluate(game);
  }

  const moves = orderMoves(game.allLegalMoves(game.turn));
  if (moves.length === 0) {
    return game.isInCheck(game.turn) ? -MATE_SCORE - depth : 0;
  }

  let best = -Infinity;
  for (const move of moves) {
    const child = game.clone();
    child.makeMove({ from: move.from, to: move.to, promotion: move.promotion || null });
    const score = -negamax(child, depth - 1, -beta, -alpha, -colorSign, useQuiescence, deadline);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

const LEVELS = {
  beginner: { depth: 1, margin: 150, blunderChance: 0.35, quiescence: false, timeMs: 400 },
  easy: { depth: 2, margin: 60, blunderChance: 0.12, quiescence: false, timeMs: 700 },
  medium: { depth: 3, margin: 20, blunderChance: 0, quiescence: true, timeMs: 1500 },
  hard: { depth: 4, margin: 0, blunderChance: 0, quiescence: true, timeMs: 3000 },
};

function pickMove(game, difficulty) {
  const cfg = LEVELS[difficulty] || LEVELS.medium;
  const rootMoves = game.allLegalMoves(game.turn);
  if (rootMoves.length === 0) return null;

  if (Math.random() < cfg.blunderChance) {
    return rootMoves[Math.floor(Math.random() * rootMoves.length)];
  }

  const colorSign = game.turn === "w" ? 1 : -1;
  const deadline = performance.now() + cfg.timeMs;
  const ordered = orderMoves(rootMoves);

  let scored = [];
  let searchDepth = cfg.depth;
  if (cfg.timeMs >= 1500) {
    let currentBest = ordered;
    for (let d = 1; d <= cfg.depth; d++) {
      const results = [];
      for (const move of currentBest) {
        const child = game.clone();
        child.makeMove({ from: move.from, to: move.to, promotion: move.promotion || null });
        const score = -negamax(child, d - 1, -Infinity, Infinity, -colorSign, cfg.quiescence, deadline);
        results.push({ move, score });
        if (performance.now() > deadline) break;
      }
      results.sort((a, b) => b.score - a.score);
      currentBest = results.map((r) => r.move);
      scored = results;
      if (performance.now() > deadline) break;
    }
  } else {
    for (const move of ordered) {
      const child = game.clone();
      child.makeMove({ from: move.from, to: move.to, promotion: move.promotion || null });
      const score = -negamax(child, searchDepth - 1, -Infinity, Infinity, -colorSign, cfg.quiescence, deadline);
      scored.push({ move, score });
    }
    scored.sort((a, b) => b.score - a.score);
  }

  const best = scored[0].score;
  const within = scored.filter((r) => best - r.score <= cfg.margin);
  const choice = within[Math.floor(Math.random() * within.length)];
  return choice.move;
}

self.onmessage = (e) => {
  const { state, difficulty, requestId } = e.data;
  const game = ChessGame.fromState(state);
  const move = pickMove(game, difficulty);
  if (!move) {
    self.postMessage({ requestId, move: null });
    return;
  }
  self.postMessage({
    requestId,
    move: {
      from: move.from,
      to: move.to,
      promotion: move.promotion || null,
    },
  });
};
