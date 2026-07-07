/* ==================== Chess rules engine (no DOM, no dependencies) ==================== */

const WHITE = "w";
const BLACK = "b";

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function opponent(color) {
  return color === WHITE ? BLACK : WHITE;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function squareName(r, c) {
  return "abcdefgh"[c] + (8 - r);
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

/**
 * Board is an 8x8 array of rows, row 0 = rank 8 (black back rank), row 7 = rank 1 (white back rank).
 * Each cell is null or { type: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b' }.
 */
function initialBoard() {
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board = [];
  board.push(back.map((type) => ({ type, color: BLACK })));
  board.push(Array(8).fill(null).map(() => ({ type: "p", color: BLACK })));
  for (let i = 0; i < 4; i++) board.push(Array(8).fill(null));
  board.push(Array(8).fill(null).map(() => ({ type: "p", color: WHITE })));
  board.push(back.map((type) => ({ type, color: WHITE })));
  return board;
}

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1],
];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

class ChessGame {
  constructor() {
    this.board = initialBoard();
    this.turn = WHITE;
    this.castling = { wK: true, wQ: true, bK: true, bQ: true };
    this.enPassant = null; // { r, c } target square capturable this turn
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.history = []; // { move, san, boardBefore state snapshot for undo }
    this.positionCounts = new Map();
    this.result = null; // null | 'checkmate' | 'stalemate' | 'draw-50' | 'draw-repetition' | 'draw-material'
    this.winner = null; // 'w' | 'b' | null
    this._recordPosition();
  }

  clone() {
    const g = new ChessGame();
    g.board = cloneBoard(this.board);
    g.turn = this.turn;
    g.castling = { ...this.castling };
    g.enPassant = this.enPassant ? { ...this.enPassant } : null;
    g.halfmoveClock = this.halfmoveClock;
    g.fullmoveNumber = this.fullmoveNumber;
    g.history = this.history.slice();
    g.positionCounts = new Map(this.positionCounts);
    g.result = this.result;
    g.winner = this.winner;
    return g;
  }

  pieceAt(r, c) {
    return this.board[r][c];
  }

  isGameOver() {
    return this.result !== null;
  }

  _positionKey() {
    let key = this.turn;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        key += p ? p.color + p.type : ".";
      }
    }
    key += `|${this.castling.wK ? 1 : 0}${this.castling.wQ ? 1 : 0}${this.castling.bK ? 1 : 0}${this.castling.bQ ? 1 : 0}`;
    key += `|${this.enPassant ? squareName(this.enPassant.r, this.enPassant.c) : "-"}`;
    return key;
  }

  _recordPosition() {
    const key = this._positionKey();
    this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
  }

  findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type === "k" && p.color === color) return { r, c };
      }
    }
    return null;
  }

  isSquareAttacked(r, c, byColor) {
    const board = this.board;

    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p && p.color === byColor && p.type === "n") return true;
      }
    }

    for (const [dr, dc] of KING_OFFSETS) {
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p && p.color === byColor && p.type === "k") return true;
      }
    }

    const pawnDir = byColor === WHITE ? 1 : -1; // attacking pawn sits below(white)/above(black) target
    for (const dc of [-1, 1]) {
      const rr = r + pawnDir, cc = c + dc;
      if (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p && p.color === byColor && p.type === "p") return true;
      }
    }

    for (const [dr, dc] of BISHOP_DIRS) {
      let rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p) {
          if (p.color === byColor && (p.type === "b" || p.type === "q")) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }

    for (const [dr, dc] of ROOK_DIRS) {
      let rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p) {
          if (p.color === byColor && (p.type === "r" || p.type === "q")) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }

    return false;
  }

  isInCheck(color) {
    const king = this.findKing(color);
    if (!king) return false;
    return this.isSquareAttacked(king.r, king.c, opponent(color));
  }

  _pseudoMovesForPiece(r, c) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];
    const push = (rr, cc, flags = {}) => moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: p, ...flags });

    if (p.type === "p") {
      const dir = p.color === WHITE ? -1 : 1;
      const startRow = p.color === WHITE ? 6 : 1;
      const promoRow = p.color === WHITE ? 0 : 7;
      const oneR = r + dir;
      if (inBounds(oneR, c) && !this.board[oneR][c]) {
        if (oneR === promoRow) {
          for (const promo of ["q", "r", "b", "n"]) push(oneR, c, { promotion: promo });
        } else {
          push(oneR, c);
          const twoR = r + dir * 2;
          if (r === startRow && !this.board[twoR][c]) push(twoR, c, { doubleStep: true });
        }
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (!inBounds(oneR, cc)) continue;
        const target = this.board[oneR][cc];
        if (target && target.color !== p.color) {
          if (oneR === promoRow) {
            for (const promo of ["q", "r", "b", "n"]) push(oneR, cc, { capture: true, promotion: promo });
          } else {
            push(oneR, cc, { capture: true });
          }
        } else if (!target && this.enPassant && this.enPassant.r === oneR && this.enPassant.c === cc) {
          push(oneR, cc, { capture: true, enPassant: true });
        }
      }
    } else if (p.type === "n") {
      for (const [dr, dc] of KNIGHT_OFFSETS) {
        const rr = r + dr, cc = c + dc;
        if (!inBounds(rr, cc)) continue;
        const target = this.board[rr][cc];
        if (!target || target.color !== p.color) push(rr, cc, { capture: !!target });
      }
    } else if (p.type === "k") {
      for (const [dr, dc] of KING_OFFSETS) {
        const rr = r + dr, cc = c + dc;
        if (!inBounds(rr, cc)) continue;
        const target = this.board[rr][cc];
        if (!target || target.color !== p.color) push(rr, cc, { capture: !!target });
      }
      this._addCastlingMoves(r, c, p.color, push);
    } else {
      const dirs = p.type === "b" ? BISHOP_DIRS : p.type === "r" ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inBounds(rr, cc)) {
          const target = this.board[rr][cc];
          if (!target) {
            push(rr, cc);
          } else {
            if (target.color !== p.color) push(rr, cc, { capture: true });
            break;
          }
          rr += dr; cc += dc;
        }
      }
    }
    return moves;
  }

  _addCastlingMoves(r, c, color, push) {
    if (this.isInCheck(color)) return;
    const rank = color === WHITE ? 7 : 0;
    if (r !== rank || c !== 4) return;
    const oppColor = opponent(color);

    const kingSide = color === WHITE ? this.castling.wK : this.castling.bK;
    if (kingSide && !this.board[rank][5] && !this.board[rank][6]) {
      const rook = this.board[rank][7];
      if (rook && rook.type === "r" && rook.color === color) {
        if (!this.isSquareAttacked(rank, 5, oppColor) && !this.isSquareAttacked(rank, 6, oppColor)) {
          push(rank, 6, { castle: "K" });
        }
      }
    }
    const queenSide = color === WHITE ? this.castling.wQ : this.castling.bQ;
    if (queenSide && !this.board[rank][3] && !this.board[rank][2] && !this.board[rank][1]) {
      const rook = this.board[rank][0];
      if (rook && rook.type === "r" && rook.color === color) {
        if (!this.isSquareAttacked(rank, 3, oppColor) && !this.isSquareAttacked(rank, 2, oppColor)) {
          push(rank, 2, { castle: "Q" });
        }
      }
    }
  }

  _applyMoveRaw(move) {
    const { from, to } = move;
    const board = this.board;
    const piece = board[from.r][from.c];
    const captured = board[to.r][to.c];

    board[to.r][to.c] = { type: move.promotion || piece.type, color: piece.color };
    board[from.r][from.c] = null;

    if (move.enPassant) {
      const capR = piece.color === WHITE ? to.r + 1 : to.r - 1;
      board[capR][to.c] = null;
    }

    if (move.castle === "K") {
      const rank = from.r;
      board[rank][5] = board[rank][7];
      board[rank][7] = null;
    } else if (move.castle === "Q") {
      const rank = from.r;
      board[rank][3] = board[rank][0];
      board[rank][0] = null;
    }

    return captured;
  }

  _legalMovesForPiece(r, c) {
    const p = this.board[r][c];
    if (!p) return [];
    const pseudo = this._pseudoMovesForPiece(r, c);
    const legal = [];
    for (const move of pseudo) {
      const snapshot = cloneBoard(this.board);
      const castling = { ...this.castling };
      const enPassant = this.enPassant;
      this._applyMoveRaw(move);
      const stillInCheck = this.isInCheck(p.color);
      this.board = snapshot;
      this.castling = castling;
      this.enPassant = enPassant;
      if (!stillInCheck) legal.push(move);
    }
    return legal;
  }

  legalMovesFrom(r, c) {
    const p = this.board[r][c];
    if (!p || p.color !== this.turn || this.isGameOver()) return [];
    return this._legalMovesForPiece(r, c);
  }

  allLegalMoves(color = this.turn) {
    if (this.isGameOver()) return [];
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === color) moves.push(...this._legalMovesForPiece(r, c));
      }
    }
    return moves;
  }

  _sanFor(move, legalMovesThisTurn) {
    if (move.castle === "K") return "O-O";
    if (move.castle === "Q") return "O-O-O";
    const p = move.piece;
    const destName = squareName(move.to.r, move.to.c);
    const isCapture = move.capture;

    if (p.type === "p") {
      let san = "";
      if (isCapture) san += "abcdefgh"[move.from.c] + "x";
      san += destName;
      if (move.promotion) san += "=" + move.promotion.toUpperCase();
      return san;
    }

    const letter = p.type.toUpperCase();
    const ambiguous = legalMovesThisTurn.filter(
      (m) => m !== move && m.piece.type === p.type && m.to.r === move.to.r && m.to.c === move.to.c
    );
    let disambig = "";
    if (ambiguous.length) {
      const sameFile = ambiguous.some((m) => m.from.c === move.from.c);
      const sameRank = ambiguous.some((m) => m.from.r === move.from.r);
      if (!sameFile) disambig = "abcdefgh"[move.from.c];
      else if (!sameRank) disambig = String(8 - move.from.r);
      else disambig = squareName(move.from.r, move.from.c);
    }
    return `${letter}${disambig}${isCapture ? "x" : ""}${destName}`;
  }

  makeMove(move) {
    if (this.isGameOver()) return null;
    const legalNow = this.allLegalMoves(this.turn);
    const match = legalNow.find(
      (m) =>
        m.from.r === move.from.r && m.from.c === move.from.c &&
        m.to.r === move.to.r && m.to.c === move.to.c &&
        (m.promotion || null) === (move.promotion || null)
    );
    if (!match) return null;

    const san = this._sanFor(match, legalNow);
    const piece = this.board[match.from.r][match.from.c];
    const isPawnMove = piece.type === "p";
    const captured = this._applyMoveRaw(match);

    if (piece.type === "k") {
      if (piece.color === WHITE) { this.castling.wK = false; this.castling.wQ = false; }
      else { this.castling.bK = false; this.castling.bQ = false; }
    }
    if (piece.type === "r") {
      if (match.from.r === 7 && match.from.c === 0) this.castling.wQ = false;
      if (match.from.r === 7 && match.from.c === 7) this.castling.wK = false;
      if (match.from.r === 0 && match.from.c === 0) this.castling.bQ = false;
      if (match.from.r === 0 && match.from.c === 7) this.castling.bK = false;
    }
    if (captured && captured.type === "r") {
      if (match.to.r === 7 && match.to.c === 0) this.castling.wQ = false;
      if (match.to.r === 7 && match.to.c === 7) this.castling.wK = false;
      if (match.to.r === 0 && match.to.c === 0) this.castling.bQ = false;
      if (match.to.r === 0 && match.to.c === 7) this.castling.bK = false;
    }

    this.enPassant = match.doubleStep
      ? { r: (match.from.r + match.to.r) / 2, c: match.from.c }
      : null;

    this.halfmoveClock = (isPawnMove || captured || match.enPassant) ? 0 : this.halfmoveClock + 1;
    if (this.turn === BLACK) this.fullmoveNumber += 1;

    const movedColor = this.turn;
    this.turn = opponent(this.turn);
    this._recordPosition();

    const nextMoves = this.allLegalMoves(this.turn);
    const inCheck = this.isInCheck(this.turn);
    let sanFinal = san;
    let status = "ok";
    if (nextMoves.length === 0) {
      if (inCheck) {
        sanFinal += "#";
        this.result = "checkmate";
        this.winner = movedColor;
        status = "checkmate";
      } else {
        this.result = "stalemate";
        status = "stalemate";
      }
    } else if (inCheck) {
      sanFinal += "+";
      status = "check";
    }

    if (!this.isGameOver()) {
      if (this.halfmoveClock >= 100) { this.result = "draw-50"; status = "draw"; }
      else if (this.positionCounts.get(this._positionKey()) >= 3) { this.result = "draw-repetition"; status = "draw"; }
      else if (this._isInsufficientMaterial()) { this.result = "draw-material"; status = "draw"; }
    }

    const record = {
      san: sanFinal,
      from: match.from,
      to: match.to,
      piece: piece.type,
      color: movedColor,
      capture: !!captured || !!match.enPassant,
      promotion: match.promotion || null,
      castle: match.castle || null,
      status,
    };
    this.history.push(record);
    return record;
  }

  _isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]) pieces.push(this.board[r][c]);
    if (pieces.length > 4) return false;
    const nonKings = pieces.filter((p) => p.type !== "k");
    if (nonKings.length === 0) return true;
    if (nonKings.length === 1 && (nonKings[0].type === "b" || nonKings[0].type === "n")) return true;
    if (
      nonKings.length === 2 &&
      nonKings.every((p) => p.type === "b") &&
      pieces.filter((p) => p.type === "b").length === 2
    ) {
      return true;
    }
    return false;
  }

  toState() {
    return {
      board: cloneBoard(this.board),
      turn: this.turn,
      castling: { ...this.castling },
      enPassant: this.enPassant ? { ...this.enPassant } : null,
      halfmoveClock: this.halfmoveClock,
      fullmoveNumber: this.fullmoveNumber,
    };
  }

  static fromState(state) {
    const g = new ChessGame();
    g.board = cloneBoard(state.board);
    g.turn = state.turn;
    g.castling = { ...state.castling };
    g.enPassant = state.enPassant ? { ...state.enPassant } : null;
    g.halfmoveClock = state.halfmoveClock;
    g.fullmoveNumber = state.fullmoveNumber;
    g.history = [];
    g.positionCounts = new Map();
    g.result = null;
    g.winner = null;
    g._recordPosition();
    return g;
  }

  gameStatusText() {
    if (this.result === "checkmate") return { over: true, key: "checkmate", winner: this.winner };
    if (this.result === "stalemate") return { over: true, key: "stalemate", winner: null };
    if (this.result === "draw-50") return { over: true, key: "draw50", winner: null };
    if (this.result === "draw-repetition") return { over: true, key: "drawRepetition", winner: null };
    if (this.result === "draw-material") return { over: true, key: "drawMaterial", winner: null };
    if (this.isInCheck(this.turn)) return { over: false, key: "check", winner: null };
    return { over: false, key: "playing", winner: null };
  }

  /** Rebuilds state by replaying the history minus the last `n` plies. */
  undoPlies(n) {
    const keep = this.history.slice(0, Math.max(0, this.history.length - n));
    const fresh = new ChessGame();
    for (const record of keep) {
      fresh.makeMove({ from: record.from, to: record.to, promotion: record.promotion });
    }
    this.board = fresh.board;
    this.turn = fresh.turn;
    this.castling = fresh.castling;
    this.enPassant = fresh.enPassant;
    this.halfmoveClock = fresh.halfmoveClock;
    this.fullmoveNumber = fresh.fullmoveNumber;
    this.history = fresh.history;
    this.positionCounts = fresh.positionCounts;
    this.result = fresh.result;
    this.winner = fresh.winner;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ChessGame, WHITE, BLACK, PIECE_VALUES, squareName, opponent };
}
