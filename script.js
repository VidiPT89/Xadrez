/* ==================== Xadrez — app logic ==================== */

const SVG_NS = "http://www.w3.org/2000/svg";

function pieceIcon(type) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "piece");
  svg.setAttribute("viewBox", "0 0 100 100");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#piece-${type}`);
  svg.appendChild(use);
  return svg;
}

/* ==================== i18n ==================== */
const STRINGS = {
  pt: {
    menuTitle: "Xadrez",
    menuSubtitle: "Escolhe um modo para começar",
    mode1v1: "1 vs 1",
    mode1v1Desc: "Dois jogadores, mesmo ecrã",
    modeBot: "Contra o Bot",
    modeBotDesc: "Escolhe o nível da IA",
    modeTutorial: "Tutorial",
    modeTutorialDesc: "Aprende a jogar por níveis",
    modeHelp: "Ajuda",
    modeHelpDesc: "Regras e controlos",
    chooseDifficulty: "Escolhe o nível do bot",
    levelBeginner: "Iniciante",
    levelEasy: "Fácil",
    levelMedium: "Médio",
    levelHard: "Difícil",
    cancelBtn: "Cancelar",
    blackPlayer: "Pretas",
    whitePlayer: "Brancas",
    moveHistory: "Histórico de Lances",
    undoMove: "↩️ Voltar Atrás",
    flipBoard: "🔄 Inverter",
    newGame: "♻️ Novo Jogo",
    backToMenu: "⬅️ Menu",
    prevLesson: "◀ Anterior",
    nextLesson: "Seguinte ▶",
    helpTitle: "Ajuda",
    footerBy: "Desenvolvido por",
    introTitle: "Xadrez",
    introText: "Joga 1 vs 1, desafia o bot, aprende as regras e as estratégias — tudo num só tabuleiro.",
    introSkipBtn: "Saltar",
    turnWhite: "Vez das Brancas",
    turnBlack: "Vez das Pretas",
    thinking: "🤖 O bot está a pensar…",
    inCheck: "Xeque!",
    resultCheckmateTitle: "Xeque-mate!",
    resultCheckmateWhite: "As Brancas vencem.",
    resultCheckmateBlack: "As Pretas vencem.",
    resultStalemateTitle: "Tabuada por Afogamento",
    resultStalemateText: "Nenhum jogador tem lances legais. O jogo termina empatado.",
    resultDraw50Title: "Empate",
    resultDraw50Text: "50 lances sem capturas nem movimento de peão.",
    resultDrawRepTitle: "Empate",
    resultDrawRepText: "A mesma posição repetiu-se três vezes.",
    resultDrawMatTitle: "Empate",
    resultDrawMatText: "Nenhum dos lados tem material suficiente para dar mate.",
    promoTitle: "Promover peão a:",
    lessonHintClick: "Clica numa peça para veres os seus movimentos.",
  },
  en: {
    menuTitle: "Chess",
    menuSubtitle: "Choose a mode to begin",
    mode1v1: "1 vs 1",
    mode1v1Desc: "Two players, same screen",
    modeBot: "Vs Bot",
    modeBotDesc: "Choose the AI level",
    modeTutorial: "Tutorial",
    modeTutorialDesc: "Learn to play, level by level",
    modeHelp: "Help",
    modeHelpDesc: "Rules and controls",
    chooseDifficulty: "Choose the bot's level",
    levelBeginner: "Beginner",
    levelEasy: "Easy",
    levelMedium: "Medium",
    levelHard: "Hard",
    cancelBtn: "Cancel",
    blackPlayer: "Black",
    whitePlayer: "White",
    moveHistory: "Move History",
    undoMove: "↩️ Undo",
    flipBoard: "🔄 Flip",
    newGame: "♻️ New Game",
    backToMenu: "⬅️ Menu",
    prevLesson: "◀ Previous",
    nextLesson: "Next ▶",
    helpTitle: "Help",
    footerBy: "Developed by",
    introTitle: "Chess",
    introText: "Play 1 vs 1, challenge the bot, learn the rules and strategy — all on one board.",
    introSkipBtn: "Skip",
    turnWhite: "White to move",
    turnBlack: "Black to move",
    thinking: "🤖 The bot is thinking…",
    inCheck: "Check!",
    resultCheckmateTitle: "Checkmate!",
    resultCheckmateWhite: "White wins.",
    resultCheckmateBlack: "Black wins.",
    resultStalemateTitle: "Stalemate",
    resultStalemateText: "Neither player has a legal move. The game is a draw.",
    resultDraw50Title: "Draw",
    resultDraw50Text: "50 moves without a capture or pawn move.",
    resultDrawRepTitle: "Draw",
    resultDrawRepText: "The same position occurred three times.",
    resultDrawMatTitle: "Draw",
    resultDrawMatText: "Neither side has enough material to checkmate.",
    promoTitle: "Promote pawn to:",
    lessonHintClick: "Tap a piece to see how it moves.",
  },
};

let lang = localStorage.getItem("xadrez-lang") || "pt";

function t(key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.pt[key] || key;
}

function applyTranslations() {
  document.documentElement.lang = lang === "pt" ? "pt-PT" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  el("lang-flag").textContent = lang === "pt" ? "🇵🇹" : "🇬🇧";
  el("lang-label").textContent = lang.toUpperCase();
  renderStatus();
  renderLesson();
  renderHelp();
}

function setLanguage(next) {
  lang = next;
  localStorage.setItem("xadrez-lang", lang);
  applyTranslations();
}

function el(id) { return document.getElementById(id); }

/* ==================== Sound ==================== */
let soundOn = localStorage.getItem("xadrez-sound") !== "off";
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(freq, duration, type = "sine", gain = 0.08) {
  if (!soundOn) return;
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

const SFX = {
  move: () => playTone(320, 0.09, "triangle"),
  capture: () => playTone(180, 0.14, "square", 0.09),
  check: () => { playTone(520, 0.1, "sawtooth", 0.07); setTimeout(() => playTone(660, 0.12, "sawtooth", 0.07), 90); },
  end: () => { playTone(440, 0.15, "sine", 0.09); setTimeout(() => playTone(330, 0.25, "sine", 0.09), 140); },
  click: () => playTone(700, 0.05, "sine", 0.05),
};

function updateSoundIcon() {
  el("sound-icon").textContent = soundOn ? "🔊" : "🔇";
}

el("sound-toggle").addEventListener("click", () => {
  soundOn = !soundOn;
  localStorage.setItem("xadrez-sound", soundOn ? "on" : "off");
  updateSoundIcon();
  if (soundOn) SFX.click();
});
updateSoundIcon();

el("lang-toggle").addEventListener("click", () => setLanguage(lang === "pt" ? "en" : "pt"));

/* ==================== Ambient background ==================== */
(function ambientBackground() {
  const canvas = el("bg-canvas");
  const ctx = canvas.getContext("2d");
  let w, h, particles;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function makeParticles() {
    particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.05 + Math.random() * 0.15,
      a: 0.15 + Math.random() * 0.35,
    }));
  }

  let t = 0;

  function frame() {
    t += 0.008;
    ctx.clearRect(0, 0, w, h);
    const pulse = 0.7 + Math.sin(t) * 0.3;

    const grad = ctx.createRadialGradient(w / 2, h * 0.15, 0, w / 2, h * 0.15, Math.max(w, h) * 0.75);
    grad.addColorStop(0, `rgba(212,175,55,${0.16 * pulse})`);
    grad.addColorStop(0.5, `rgba(212,175,55,${0.05 * pulse})`);
    grad.addColorStop(1, "rgba(11,10,8,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const grad2 = ctx.createRadialGradient(w * 0.85, h * 0.9, 0, w * 0.85, h * 0.9, Math.max(w, h) * 0.5);
    grad2.addColorStop(0, `rgba(232,199,101,${0.08 * pulse})`);
    grad2.addColorStop(1, "rgba(11,10,8,0)");
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#e8c765";
    ctx.shadowColor = "rgba(232,199,101,0.9)";
    ctx.shadowBlur = 6;
    for (const p of particles) {
      ctx.globalAlpha = p.a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.y -= p.vy;
      if (p.y < -5) p.y = h + 5;
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => { resize(); makeParticles(); });
  resize();
  makeParticles();
  frame();
})();

/* ==================== Board controller (reused for main game + lessons) ==================== */
class BoardController {
  constructor(boardEl, { interactive = true, onAfterMove = null } = {}) {
    this.boardEl = boardEl;
    this.interactive = interactive;
    this.onAfterMove = onAfterMove;
    this.game = null;
    this.selected = null;
    this.legalTargets = [];
    this.flipped = false;
    this.lastMove = null;
    this.locked = false;
    this._buildSquares();
  }

  _buildSquares() {
    this.boardEl.innerHTML = "";
    this.cells = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement("div");
        sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");
        sq.dataset.r = r;
        sq.dataset.c = c;
        sq.addEventListener("click", () => this._onSquareClick(r, c));
        this.boardEl.appendChild(sq);
        row.push(sq);
      }
      this.cells.push(row);
    }
  }

  setGame(game) {
    this.game = game;
    this.selected = null;
    this.legalTargets = [];
    this.lastMove = null;
    this.render();
  }

  setFlipped(flipped) {
    this.flipped = flipped;
    this.render();
  }

  _displayCoords(r, c) {
    return this.flipped ? [7 - r, 7 - c] : [r, c];
  }

  _cellFor(r, c) {
    const [dr, dc] = this._displayCoords(r, c);
    return this.cells[dr][dc];
  }

  render() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = this._cellFor(r, c);
        const piece = this.game.pieceAt(r, c);
        cell.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");
        cell.innerHTML = "";
        if (piece) {
          cell.appendChild(pieceIcon(piece.type));
          cell.classList.add(piece.color === "w" ? "piece-white" : "piece-black");
        }
        if (this.selected && this.selected.r === r && this.selected.c === c) cell.classList.add("is-selected");
        if (this.lastMove && ((this.lastMove.from.r === r && this.lastMove.from.c === c) || (this.lastMove.to.r === r && this.lastMove.to.c === c))) {
          cell.classList.add("is-last-move");
        }
        if (this.legalTargets.some((m) => m.to.r === r && m.to.c === c)) {
          const hasCapture = this.legalTargets.some((m) => m.to.r === r && m.to.c === c && m.capture);
          cell.classList.add(hasCapture ? "is-legal-capture" : "is-legal");
        }
      }
    }
    const king = this.game.isInCheck(this.game.turn) ? this.game.findKing(this.game.turn) : null;
    if (king) this._cellFor(king.r, king.c).classList.add("is-check");
  }

  _onSquareClick(dr, dc) {
    if (!this.interactive || this.locked || !this.game || this.game.isGameOver()) return;
    const [r, c] = this.flipped ? [7 - dr, 7 - dc] : [dr, dc];
    const piece = this.game.pieceAt(r, c);

    if (this.selected) {
      const target = this.legalTargets.filter((m) => m.to.r === r && m.to.c === c);
      if (target.length) {
        this._attemptMove(target);
        return;
      }
    }

    if (piece && piece.color === this.game.turn) {
      this.selected = { r, c };
      this.legalTargets = this.game.legalMovesFrom(r, c);
      SFX.click();
      this.render();
    } else {
      this.selected = null;
      this.legalTargets = [];
      this.render();
    }
  }

  _attemptMove(candidates) {
    let move = candidates[0];
    if (candidates.length > 1) {
      this._askPromotion((promo) => {
        const chosen = candidates.find((m) => m.promotion === promo) || candidates[0];
        this._finalizeMove(chosen);
      });
      return;
    }
    this._finalizeMove(move);
  }

  _askPromotion(callback) {
    const overlay = el("promo-overlay");
    const choicesEl = el("promo-choices");
    el("promo-title").textContent = t("promoTitle");
    choicesEl.innerHTML = "";
    const color = this.game.turn;
    ["q", "r", "b", "n"].forEach((type) => {
      const btn = document.createElement("button");
      btn.className = "promo-choice";
      btn.appendChild(pieceIcon(type));
      btn.classList.add(color === "w" ? "piece-white" : "piece-black");
      btn.addEventListener("click", () => {
        overlay.classList.remove("is-open");
        callback(type);
      });
      choicesEl.appendChild(btn);
    });
    overlay.classList.add("is-open");
  }

  _finalizeMove(move) {
    const wasCapture = move.capture;
    const fromRect = this._cellFor(move.from.r, move.from.c).getBoundingClientRect();
    let rookAnim = null;
    if (move.castle) {
      const rank = move.from.r;
      const rookFromC = move.castle === "K" ? 7 : 0;
      const rookToC = move.castle === "K" ? 5 : 3;
      rookAnim = { fromRect: this._cellFor(rank, rookFromC).getBoundingClientRect(), r: rank, c: rookToC };
    }

    const record = this.game.makeMove({ from: move.from, to: move.to, promotion: move.promotion || null });
    if (!record) return;
    this.selected = null;
    this.legalTargets = [];
    this.lastMove = { from: move.from, to: move.to };
    this.render();
    this._slidePiece(this._cellFor(move.to.r, move.to.c), fromRect);
    if (rookAnim) this._slidePiece(this._cellFor(rookAnim.r, rookAnim.c), rookAnim.fromRect);
    if (record.status === "check") SFX.check();
    else if (this.game.isGameOver()) SFX.end();
    else if (wasCapture) SFX.capture();
    else SFX.move();
    if (this.onAfterMove) this.onAfterMove(record);
  }

  /** FLIP-technique slide: the piece already sits at its final DOM position, so we offset it
   * back to where it started (no transition) and then animate the offset away to zero. */
  _slidePiece(cell, fromRect) {
    const piece = cell.querySelector(".piece");
    if (!piece) return;
    const toRect = cell.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    if (!dx && !dy) return;
    piece.style.transition = "none";
    piece.style.transform = `translate(${dx}px, ${dy}px)`;
    void piece.getBoundingClientRect();
    requestAnimationFrame(() => {
      piece.style.transition = "transform 180ms ease";
      piece.style.transform = "translate(0, 0)";
    });
  }

  applyExternalMove(move) {
    this._finalizeMove({ from: move.from, to: move.to, promotion: move.promotion, capture: !!this.game.pieceAt(move.to.r, move.to.c) });
  }
}

/* ==================== Main game state ==================== */
const mainBoard = new BoardController(el("board"), { interactive: true, onAfterMove: onMainMove });
let currentMode = "1v1"; // '1v1' | 'bot'
let botLevel = "medium";
const BOT_COLOR = "b";
let aiWorker = null;
let requestCounter = 0;

function getWorker() {
  if (!aiWorker) aiWorker = new Worker("chess-ai.js");
  return aiWorker;
}

function newMainGame() {
  const game = new ChessGame();
  mainBoard.setGame(game);
  mainBoard.locked = false;
  requestCounter++;
  el("btn-undo").classList.toggle("is-hidden", currentMode !== "bot");
  renderStatus();
  renderMoveList();
  el("result-overlay").classList.remove("is-open");
}

function undoLastTurn() {
  if (currentMode !== "bot" || mainBoard.locked || !mainBoard.game || mainBoard.game.history.length === 0) return;
  const removeCount = mainBoard.game.history.length % 2 === 0 ? 2 : 1;
  mainBoard.game.undoPlies(removeCount);
  mainBoard.selected = null;
  mainBoard.legalTargets = [];
  mainBoard.lastMove = null;
  mainBoard.render();
  renderMoveList();
  renderStatus();
  el("result-overlay").classList.remove("is-open");
  SFX.click();
}

function renderStatus() {
  if (!mainBoard.game) return;
  const status = mainBoard.game.gameStatusText();
  el("status-turn").textContent = mainBoard.game.turn === "w" ? t("turnWhite") : t("turnBlack");
  el("player-tag-white").classList.toggle("is-active", mainBoard.game.turn === "w" && !status.over);
  el("player-tag-black").classList.toggle("is-active", mainBoard.game.turn === "b" && !status.over);
  el("btn-undo").disabled = mainBoard.locked || mainBoard.game.history.length === 0;
  let note = "";
  if (mainBoard.locked) note = t("thinking");
  else if (status.key === "check") note = t("inCheck");
  el("status-note").textContent = note;
}

function renderMoveList() {
  const listEl = el("move-list");
  listEl.innerHTML = "";
  const history = mainBoard.game.history;
  for (let i = 0; i < history.length; i += 2) {
    const li = document.createElement("li");
    const white = history[i];
    const black = history[i + 1];
    li.textContent = `${white.san}${black ? "   " + black.san : ""}`;
    listEl.appendChild(li);
  }
  listEl.scrollTop = listEl.scrollHeight;
}

function showResultModal() {
  const status = mainBoard.game.gameStatusText();
  const icon = el("result-icon");
  const title = el("result-title");
  const text = el("result-text");
  if (status.key === "checkmate") {
    icon.textContent = "🏆";
    title.textContent = t("resultCheckmateTitle");
    text.textContent = status.winner === "w" ? t("resultCheckmateWhite") : t("resultCheckmateBlack");
  } else if (status.key === "stalemate") {
    icon.textContent = "🤝";
    title.textContent = t("resultStalemateTitle");
    text.textContent = t("resultStalemateText");
  } else if (mainBoard.game.result === "draw-50") {
    icon.textContent = "🤝";
    title.textContent = t("resultDraw50Title");
    text.textContent = t("resultDraw50Text");
  } else if (mainBoard.game.result === "draw-repetition") {
    icon.textContent = "🤝";
    title.textContent = t("resultDrawRepTitle");
    text.textContent = t("resultDrawRepText");
  } else {
    icon.textContent = "🤝";
    title.textContent = t("resultDrawMatTitle");
    text.textContent = t("resultDrawMatText");
  }
  el("result-overlay").classList.add("is-open");
}

function onMainMove(record) {
  renderMoveList();
  renderStatus();
  if (mainBoard.game.isGameOver()) {
    showResultModal();
    return;
  }
  if (currentMode === "bot" && mainBoard.game.turn === BOT_COLOR) {
    requestBotMove();
  }
}

function requestBotMove() {
  mainBoard.locked = true;
  renderStatus();
  const myRequest = ++requestCounter;
  const state = mainBoard.game.toState();
  getWorker().onmessage = (e) => {
    if (e.data.requestId !== myRequest) return;
    mainBoard.locked = false;
    if (e.data.move) mainBoard.applyExternalMove(e.data.move);
    renderStatus();
  };
  getWorker().postMessage({ state, difficulty: botLevel, requestId: myRequest });
}

/* ==================== Screen routing ==================== */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
  el(id).classList.add("is-active");
  el("difficulty-panel").classList.remove("is-open");
  requestCounter++; // invalidate any pending bot response tied to previous screen
}

el("mode-1v1").addEventListener("click", () => {
  currentMode = "1v1";
  newMainGame();
  showScreen("screen-game");
});

el("mode-bot").addEventListener("click", () => {
  el("difficulty-panel").classList.add("is-open");
});

el("difficulty-cancel").addEventListener("click", () => {
  el("difficulty-panel").classList.remove("is-open");
});

document.querySelectorAll(".difficulty-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentMode = "bot";
    botLevel = btn.dataset.level;
    newMainGame();
    showScreen("screen-game");
  });
});

el("mode-tutorial").addEventListener("click", () => showScreen("screen-tutorial"));
el("mode-help").addEventListener("click", () => showScreen("screen-help"));
el("btn-back-menu").addEventListener("click", () => showScreen("screen-menu"));
el("tutorial-back-menu").addEventListener("click", () => showScreen("screen-menu"));
el("help-back-menu").addEventListener("click", () => showScreen("screen-menu"));
el("btn-new-game").addEventListener("click", () => newMainGame());
el("btn-flip").addEventListener("click", () => mainBoard.setFlipped(!mainBoard.flipped));
el("btn-undo").addEventListener("click", () => undoLastTurn());
el("result-rematch").addEventListener("click", () => { el("result-overlay").classList.remove("is-open"); newMainGame(); });
el("result-menu").addEventListener("click", () => { el("result-overlay").classList.remove("is-open"); showScreen("screen-menu"); });

/* ==================== Tutorial ==================== */
function placePieces(list) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [square, type, color] of list) {
    const file = "abcdefgh".indexOf(square[0]);
    const rank = 8 - parseInt(square[1], 10);
    board[rank][file] = { type, color };
  }
  return board;
}

function customGame(pieceList, turn = "w") {
  const g = new ChessGame();
  g.board = placePieces(pieceList);
  g.turn = turn;
  g.castling = { wK: false, wQ: false, bK: false, bQ: false };
  g.enPassant = null;
  g.history = [];
  return g;
}

const LESSONS = [
  {
    id: "movement",
    title: { pt: "1. Como as peças se movem", en: "1. How the pieces move" },
    text: {
      pt: "Cada peça move-se de forma diferente. O peão avança uma casa (duas no primeiro lance) e captura na diagonal. O cavalo salta em 'L'. O bispo move-se na diagonal. A torre move-se em linha reta. A dama combina torre e bispo. O rei move-se uma casa em qualquer direção.\n\nToca numa peça do tabuleiro para veres exatamente para onde ela pode ir.",
      en: "Every piece moves differently. The pawn advances one square (two on its first move) and captures diagonally. The knight jumps in an 'L' shape. The bishop moves diagonally. The rook moves in straight lines. The queen combines rook and bishop. The king moves one square in any direction.\n\nTap a piece on the board to see exactly where it can go.",
    },
    setup: () => customGame([
      ["d4", "n", "w"], ["b6", "b", "w"], ["g2", "r", "w"], ["a2", "p", "w"], ["f6", "q", "b"], ["e8", "k", "b"],
    ]),
  },
  {
    id: "special",
    title: { pt: "2. Regras especiais", en: "2. Special rules" },
    text: {
      pt: "O roque move o rei duas casas em direção à torre (e a torre salta para o outro lado do rei), desde que nenhum dos dois se tenha mexido e as casas entre eles estejam livres e fora de ataque.\n\nO en passant permite a um peão capturar um peão adversário que acabou de avançar duas casas, como se tivesse avançado só uma.\n\nUm peão que chega à última fileira é promovido — normalmente a dama.\n\nXeque é quando o rei está sob ataque; xeque-mate é quando não há forma de escapar; afogamento (stalemate) é quando o jogador não tem lances legais mas não está em xeque — resulta em empate.",
      en: "Castling moves the king two squares toward a rook (and the rook jumps to the other side of the king), as long as neither has moved and the squares between them are empty and not under attack.\n\nEn passant lets a pawn capture an enemy pawn that just advanced two squares, as if it had only moved one.\n\nA pawn reaching the last rank is promoted — usually to a queen.\n\nCheck is when the king is under attack; checkmate is when there is no way to escape; stalemate is when a player has no legal move but isn't in check — the game is a draw.",
    },
    setup: () => customGame([
      ["e1", "k", "w"], ["h1", "r", "w"], ["a1", "r", "w"], ["e8", "k", "b"],
    ]),
  },
  {
    id: "opening",
    title: { pt: "3. Princípios de abertura", en: "3. Opening principles" },
    text: {
      pt: "Controla o centro (casas d4, d5, e4, e5) com peões e peças. Desenvolve cavalos e bispos cedo, antes da dama. Roca cedo para pores o rei em segurança. Evita mover a mesma peça várias vezes na abertura e não saias com a dama demasiado cedo — ela pode ser atacada e perder tempo.",
      en: "Control the center (the d4, d5, e4, e5 squares) with pawns and pieces. Develop knights and bishops early, before the queen. Castle early to keep your king safe. Avoid moving the same piece multiple times in the opening, and don't bring your queen out too soon — it can be attacked and lose you tempo.",
    },
    setup: () => customGame([
      ["e4", "p", "w"], ["c3", "n", "w"], ["f3", "n", "w"], ["e1", "k", "w"],
      ["e5", "p", "b"], ["c6", "n", "b"], ["f6", "n", "b"], ["e8", "k", "b"],
    ]),
  },
  {
    id: "tactics",
    title: { pt: "4. Táticas básicas", en: "4. Basic tactics" },
    text: {
      pt: "Garfo: uma peça ataca duas peças adversárias ao mesmo tempo (o cavalo é excelente nisto). Cravo: uma peça não se pode mover porque exporia uma peça mais valiosa atrás dela. Espeto: como o cravo, mas a peça mais valiosa está à frente e é forçada a mover-se, expondo a de trás. Ataque descoberto: mover uma peça revela o ataque de outra peça escondida atrás.\n\nToca no cavalo para veres um exemplo de garfo neste tabuleiro.",
      en: "Fork: one piece attacks two enemy pieces at once (the knight is excellent at this). Pin: a piece can't move because it would expose a more valuable piece behind it. Skewer: like a pin, but the more valuable piece is in front and forced to move, exposing the one behind it. Discovered attack: moving one piece reveals an attack from another piece hidden behind it.\n\nTap the knight to see a fork example on this board.",
    },
    setup: () => customGame([
      ["e5", "n", "w"], ["d7", "k", "b"], ["f7", "r", "b"],
    ]),
  },
  {
    id: "endgame",
    title: { pt: "5. Finais básicos", en: "5. Basic endgames" },
    text: {
      pt: "Com rei e dama contra rei sozinho, encurrala o rei adversário para a margem do tabuleiro usando a dama a uma 'distância de cavalo', trazendo o teu rei para ajudar a dar o mate.\n\nOposição: em finais de rei e peão, ter o teu rei diretamente à frente do rei adversário (com uma casa de intervalo) força-o a recuar.\n\nUm peão passado (sem peões adversários a travá-lo nas colunas vizinhas) é um trunfo enorme — protege-o e empurra-o para promoção.",
      en: "With king and queen versus a lone king, herd the enemy king to the edge of the board using the queen at a 'knight's distance', and bring your own king up to help deliver mate.\n\nOpposition: in king-and-pawn endgames, having your king directly facing the enemy king (with one square between them) forces it to give way.\n\nA passed pawn (with no enemy pawns able to stop it on neighboring files) is a huge asset — protect it and push it toward promotion.",
    },
    setup: () => customGame([
      ["e1", "k", "w"], ["d5", "q", "w"], ["e8", "k", "b"],
    ]),
  },
];

let lessonIndex = 0;
const lessonBoard = new BoardController(el("lesson-board"), { interactive: true });

function buildLessonNav() {
  const nav = el("lesson-nav");
  nav.innerHTML = "";
  LESSONS.forEach((lesson, i) => {
    const btn = document.createElement("button");
    btn.className = "lesson-nav-item";
    btn.type = "button";
    btn.addEventListener("click", () => { lessonIndex = i; renderLesson(); });
    nav.appendChild(btn);
  });
}

function renderLesson() {
  if (!LESSONS.length) return;
  const lesson = LESSONS[lessonIndex];
  el("lesson-title").textContent = lesson.title[lang] || lesson.title.pt;
  el("lesson-text").textContent = lesson.text[lang] || lesson.text.pt;
  el("lesson-hint").textContent = t("lessonHintClick");
  lessonBoard.setGame(lesson.setup());
  document.querySelectorAll(".lesson-nav-item").forEach((btn, i) => {
    btn.textContent = LESSONS[i].title[lang].replace(/^\d+\.\s*/, "");
    btn.classList.toggle("is-active", i === lessonIndex);
  });
  el("lesson-prev").disabled = lessonIndex === 0;
  el("lesson-next").disabled = lessonIndex === LESSONS.length - 1;
}

el("lesson-prev").addEventListener("click", () => { if (lessonIndex > 0) { lessonIndex--; renderLesson(); } });
el("lesson-next").addEventListener("click", () => { if (lessonIndex < LESSONS.length - 1) { lessonIndex++; renderLesson(); } });

/* ==================== Help ==================== */
const HELP_BLOCKS = [
  {
    title: { pt: "Objetivo", en: "Objective" },
    body: {
      pt: "Dar xeque-mate ao rei adversário — colocá-lo sob ataque sem qualquer forma de escapar.",
      en: "Checkmate the opponent's king — put it under attack with no way to escape.",
    },
  },
  {
    title: { pt: "Como jogar", en: "How to play" },
    body: {
      pt: "Toca numa peça tua para a selecionar — os lances possíveis ficam marcados com um ponto (ou um anel, se for uma captura). Toca numa das casas marcadas para jogar. Toca noutra peça tua para trocar a seleção.",
      en: "Tap one of your pieces to select it — legal moves are marked with a dot (or a ring, for a capture). Tap a marked square to play the move. Tap another of your pieces to change the selection.",
    },
  },
  {
    title: { pt: "Modos de jogo", en: "Game modes" },
    body: {
      pt: "• 1 vs 1 — dois jogadores alternam turnos no mesmo dispositivo.\n• Contra o Bot — escolhe entre 4 níveis de dificuldade (Iniciante a Difícil); jogas sempre com as Brancas e o bot joga com as Pretas.\n• Tutorial — lições passo-a-passo sobre movimentação, regras especiais, aberturas, táticas e finais.",
      en: "• 1 vs 1 — two players take turns on the same device.\n• Vs Bot — choose between 4 difficulty levels (Beginner to Hard); you always play White and the bot plays Black.\n• Tutorial — step-by-step lessons on piece movement, special rules, openings, tactics and endgames.",
    },
  },
  {
    title: { pt: "Controlos", en: "Controls" },
    body: {
      pt: "🔄 Inverter — roda o tabuleiro 180°.\n♻️ Novo Jogo — reinicia a partida atual.\n⬅️ Menu — volta ao menu principal.\n🔊 — liga/desliga o som.\n🇵🇹/🇬🇧 — muda o idioma entre Português e Inglês.",
      en: "🔄 Flip — rotates the board 180°.\n♻️ New Game — restarts the current match.\n⬅️ Menu — returns to the main menu.\n🔊 — toggles sound on/off.\n🇵🇹/🇬🇧 — switches the language between Portuguese and English.",
    },
  },
];

function renderHelp() {
  const container = el("help-content");
  container.innerHTML = "";
  HELP_BLOCKS.forEach((block) => {
    const div = document.createElement("div");
    div.className = "help-block";
    const h3 = document.createElement("h3");
    h3.textContent = block.title[lang] || block.title.pt;
    const p = document.createElement("p");
    p.style.whiteSpace = "pre-line";
    p.textContent = block.body[lang] || block.body.pt;
    div.appendChild(h3);
    div.appendChild(p);
    container.appendChild(div);
  });
}

/* ==================== Intro splash ==================== */
const INTRO_DURATION = 3200;
let introOpen = true;
let introTimer = null;
const introOverlay = el("intro-overlay");
const introProgressFill = el("intro-progress-fill");

function startIntroTimer() {
  introProgressFill.classList.add("is-running");
  introTimer = setTimeout(closeIntro, INTRO_DURATION);
}
function closeIntro() {
  if (!introOpen) return;
  introOpen = false;
  clearTimeout(introTimer);
  introOverlay.classList.remove("is-open");
  ensureAudio();
  playTone(440, 0.07);
}
el("intro-play").addEventListener("click", closeIntro);
introOverlay.addEventListener("click", (e) => { if (e.target === introOverlay) closeIntro(); });
startIntroTimer();

/* ==================== Boot ==================== */
buildLessonNav();
newMainGame();
applyTranslations();
