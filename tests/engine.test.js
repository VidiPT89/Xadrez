/* Engine + bot checks, no dependencies: `node tests/engine.test.js` (exits 1 on failure).
 * Perft counts every legal move tree to a fixed depth from well-known positions and compares
 * against published totals — it catches castling, en passant, promotion and pin bugs at once. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { ChessGame } = require("../chess-engine.js");

let failures = 0;
function check(label, got, expected) {
  if (got !== expected) {
    failures++;
    console.log(`FAIL ${label}: got ${got}, expected ${expected}`);
  }
}

const sq = (s) => ({ r: 8 - Number(s[1]), c: "abcdefgh".indexOf(s[0]) });

function fromFen(fen) {
  const [placement, turn, castling, ep] = fen.split(" ");
  const board = placement.split("/").map((row) => {
    const cells = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push(null);
      else cells.push({ type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? "w" : "b" });
    }
    return cells;
  });
  return ChessGame.fromState({
    board,
    turn,
    castling: { wK: castling.includes("K"), wQ: castling.includes("Q"), bK: castling.includes("k"), bQ: castling.includes("q") },
    enPassant: ep === "-" ? null : sq(ep),
    halfmoveClock: 0,
    fullmoveNumber: 1,
  });
}

function perft(game, depth) {
  const moves = game.allLegalMoves(game.turn);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const m of moves) {
    const child = game.clone();
    child.history = [];
    child.makeMove({ from: m.from, to: m.to, promotion: m.promotion });
    child.result = null; // draws end a real game, but perft must keep counting
    nodes += perft(child, depth - 1);
  }
  return nodes;
}

const PERFT = [
  ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [20, 400, 8902]],
  ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
  ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
  ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
  ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
];
for (const [fen, counts] of PERFT) {
  counts.forEach((expected, i) => check(`perft ${i + 1} ${fen}`, perft(fromFen(fen), i + 1), expected));
}

// Insufficient material: reached by capturing the rook on d2 with the king.
const MATERIAL = [
  ["4k3/8/8/8/8/8/3r4/2B1KB2 w - - 0 1", null],          // bishops on both colours can mate
  ["4kb2/8/8/8/8/8/3r4/2B1K3 w - - 0 1", "draw-material"], // KB vs KB, same square colour
  ["2b1k3/8/8/8/8/8/3r4/2B1K3 w - - 0 1", null],         // KB vs KB, opposite colours
  ["4k3/8/8/8/8/8/3r4/1N2K3 w - - 0 1", "draw-material"],  // lone knight
];
for (const [fen, expected] of MATERIAL) {
  const g = fromFen(fen);
  g.makeMove({ from: sq("e1"), to: sq("d2") });
  check(`material ${fen}`, g.result, expected);
}

// Threefold repetition, including after a double step whose en passant square nobody can use.
const rep = new ChessGame();
for (const [a, b] of [["e2", "e4"], ["g8", "f6"], ["g1", "f3"], ["f6", "g8"], ["f3", "g1"], ["g8", "f6"], ["g1", "f3"], ["f6", "g8"], ["f3", "g1"]]) {
  rep.makeMove({ from: sq(a), to: sq(b) });
}
check("threefold repetition", rep.result, "draw-repetition");

// Fool's mate: checkmate detection and SAN suffix.
const fool = new ChessGame();
for (const [a, b] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) fool.makeMove({ from: sq(a), to: sq(b) });
check("fool's mate result", fool.result, "checkmate");
check("fool's mate SAN", fool.history[3].san, "Qh4#");

// The bot (a Web Worker script) must find a mate in one at every searching level.
const ctx = { performance, Math, console, Map, Infinity };
ctx.self = ctx;
ctx.importScripts = () => {
  const src = fs.readFileSync(path.join(__dirname, "../chess-engine.js"), "utf8")
    .replace(/^const /gm, "var ").replace(/^class ChessGame/m, "var ChessGame = class ChessGame");
  vm.runInContext(src, ctx);
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../chess-ai.js"), "utf8"), ctx);
const mateState = fromFen("r3k3/8/8/8/8/8/5PPP/6K1 b - - 0 1").toState();
for (const difficulty of ["medium", "hard"]) {
  let reply = null;
  ctx.postMessage = (m) => { reply = m; };
  ctx.onmessage({ data: { state: mateState, difficulty, requestId: 1 } });
  check(`bot ${difficulty} finds Ra1#`, JSON.stringify(reply.move && reply.move.to), JSON.stringify(sq("a1")));
}

if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("All engine checks passed");
