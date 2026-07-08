/* ==================== 3D board renderer (Three.js) ==================== */
/* global THREE, ChessGame */

/* ---- Lathe profile helpers ---- */
function sphereBump(centerH, radius, steps, startFrac = 0, endFrac = 1) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = startFrac + (endFrac - startFrac) * (i / steps);
    const angle = t * Math.PI;
    pts.push([Math.sin(angle) * radius, centerH - Math.cos(angle) * radius]);
  }
  return pts;
}

function buildProfile(segments) {
  const pts = [];
  for (const seg of segments) {
    if (Array.isArray(seg)) pts.push(...seg);
    else pts.push(seg);
  }
  return pts.map(([r, h]) => new THREE.Vector2(Math.max(r, 0.0001), h));
}

/* ---- Per-piece lathe profiles (radius, height), bottom to top ---- */

const FOOT = [
  [0, 0],
  [0.34, 0],
  [0.34, 0.035],
  [0.30, 0.06],
];

const PAWN_PROFILE = buildProfile([
  FOOT,
  [[0.16, 0.12], [0.135, 0.26]],
  sphereBump(0.30, 0.06, 6),
  [[0.11, 0.36]],
  sphereBump(0.48, 0.1, 10),
]);

const ROOK_PROFILE = buildProfile([
  FOOT,
  [[0.28, 0.10], [0.20, 0.20], [0.19, 0.40], [0.24, 0.46], [0.24, 0.50], [0.26, 0.52], [0.26, 0.56], [0, 0.56]],
]);

const BISHOP_PROFILE = buildProfile([
  FOOT,
  [[0.17, 0.12], [0.135, 0.20]],
  sphereBump(0.42, 0.15, 12),
  [[0.05, 0.60], [0.045, 0.63]],
  sphereBump(0.68, 0.05, 8),
]);

const KNIGHT_PROFILE = buildProfile([
  FOOT,
  [[0.24, 0.10], [0.18, 0.22], [0.20, 0.34], [0.17, 0.42], [0.15, 0.5], [0.13, 0.56], [0, 0.56]],
]);

const QUEEN_PROFILE = buildProfile([
  FOOT,
  [[0.19, 0.12], [0.145, 0.24]],
  sphereBump(0.50, 0.18, 12),
  [[0.10, 0.72]],
  sphereBump(0.78, 0.055, 8),
]);

const KING_PROFILE = buildProfile([
  FOOT,
  [[0.19, 0.12], [0.145, 0.24]],
  sphereBump(0.50, 0.18, 12),
  [[0.10, 0.74], [0.09, 0.78], [0.12, 0.80], [0.12, 0.84], [0.04, 0.84], [0.04, 0.90], [0.10, 0.90], [0.10, 0.94], [0.04, 0.94], [0.04, 1.0], [0, 1.0]],
]);

const PROFILES = { p: PAWN_PROFILE, r: ROOK_PROFILE, b: BISHOP_PROFILE, n: KNIGHT_PROFILE, q: QUEEN_PROFILE, k: KING_PROFILE };

/* ---- Materials ---- */
function pieceMaterial(color) {
  return color === "w"
    ? new THREE.MeshStandardMaterial({ color: 0xf5ecd4, roughness: 0.38, metalness: 0.08 })
    : new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.32, metalness: 0.12 });
}

/* ---- Knight is not radially symmetric: build it as an extruded silhouette instead of a lathe. ---- */
function buildKnightShape() {
  const s = new THREE.Shape();
  const P = (x, y) => [x * 0.011, y * 0.011]; // scale from the 0-100 2D design to ~1-unit pieces
  s.moveTo(...P(50 - 14, 88));
  s.bezierCurveTo(...P(50 - 10, 80), ...P(50 - 8, 74), ...P(50 - 12, 66));
  s.bezierCurveTo(...P(50 - 8, 60), ...P(50 - 10, 50), ...P(50 - 18, 44));
  s.bezierCurveTo(...P(50 - 16, 38), ...P(50 - 20, 30), ...P(50 - 28, 26));
  s.bezierCurveTo(...P(50 - 30, 22), ...P(50 - 34, 20), ...P(50 - 38, 24));
  s.bezierCurveTo(...P(50 - 34, 26), ...P(50 - 32, 29), ...P(50 - 34, 32));
  s.bezierCurveTo(...P(50 - 40, 34), ...P(50 - 50, 37), ...P(50 - 60, 43));
  s.bezierCurveTo(...P(50 - 66, 47), ...P(50 - 68, 51), ...P(50 - 64, 54));
  s.bezierCurveTo(...P(50 - 60, 55), ...P(50 - 58, 53), ...P(50 - 54, 51));
  s.bezierCurveTo(...P(50 - 56, 57), ...P(50 - 54, 61), ...P(50 - 48, 64));
  s.bezierCurveTo(...P(50 - 44, 60), ...P(50 - 40, 58), ...P(50 - 36, 60));
  s.bezierCurveTo(...P(50 - 38, 66), ...P(50 - 42, 72), ...P(50 - 44, 78));
  s.bezierCurveTo(...P(50 - 45, 82), ...P(50 - 46, 85), ...P(50 - 46, 88));
  s.lineTo(...P(50 - 14, 88));
  return s;
}

function buildKnightGeometry() {
  const shape = buildKnightShape();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 12 });
  geo.translate(0, 0, -0.11);
  geo.rotateX(Math.PI); // SVG y-down -> world y-up, and mirror so it stands upright
  geo.computeBoundingBox();
  const midX = (geo.boundingBox.max.x + geo.boundingBox.min.x) / 2;
  const minY = geo.boundingBox.min.y;
  geo.translate(-midX, -minY, 0); // center on X, sit the base at y=0
  geo.computeVertexNormals();
  return geo;
}

const geometryCache = {};

function pieceGeometry(type) {
  if (type === "n") {
    if (!geometryCache.knight) {
      geometryCache.knight = buildKnightGeometry();
      geometryCache.knight.computeBoundingSphere();
      geometryCache.knight.computeBoundingBox();
    }
    return geometryCache.knight;
  }
  if (!geometryCache[type]) {
    geometryCache[type] = new THREE.LatheGeometry(PROFILES[type], 32);
    geometryCache[type].computeVertexNormals();
    geometryCache[type].computeBoundingSphere();
    geometryCache[type].computeBoundingBox();
  }
  return geometryCache[type];
}

function addRookCrenellations(group, material) {
  const count = 8;
  const capHeight = 0.56;
  const ringRadius = 0.185;
  const boxSize = 0.095;
  const boxHeight = 0.075;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxHeight, boxSize), material);
    box.position.set(Math.cos(angle) * ringRadius, capHeight + boxHeight / 2 - 0.01, Math.sin(angle) * ringRadius);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
  }
}

function buildPieceMesh(type, color) {
  const group = new THREE.Group();
  const material = pieceMaterial(color);
  const mesh = new THREE.Mesh(pieceGeometry(type), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (type === "n") {
    mesh.position.set(0, 0, 0);
    mesh.rotation.y = color === "w" ? 0 : Math.PI;
  }
  group.add(mesh);
  if (type === "r") addRookCrenellations(group, material);
  group.userData.pieceType = type;
  return group;
}

/* ==================== Board mesh ==================== */

const SQUARE = 1; // world units per square
const BOARD_SIZE = SQUARE * 8;

function buildBoardTexture() {
  const res = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext("2d");
  const cell = res / 8;
  const light = ["#f2e6c9", "#e3d09f"];
  const dark = ["#7c563b", "#573a25"];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      const [c1, c2] = isLight ? light : dark;
      const grad = ctx.createLinearGradient(c * cell, r * cell, (c + 1) * cell, (r + 1) * cell);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function buildBoardMesh() {
  const group = new THREE.Group();

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_SIZE, 0.12, BOARD_SIZE),
    new THREE.MeshStandardMaterial({ map: buildBoardTexture(), roughness: 0.55, metalness: 0.05 })
  );
  top.position.y = -0.06;
  top.receiveShadow = true;
  top.castShadow = false;
  group.add(top);

  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_SIZE + 0.5, 0.34, BOARD_SIZE + 0.5),
    new THREE.MeshStandardMaterial({ color: 0x3a2716, roughness: 0.6, metalness: 0.05 })
  );
  rim.position.y = -0.29;
  rim.receiveShadow = true;
  group.add(rim);

  return group;
}

/* World-space center of square (r, c), accounting for board orientation. */
function squareCenter(r, c, flipped) {
  const dr = flipped ? 7 - r : r;
  const dc = flipped ? 7 - c : c;
  return new THREE.Vector3((dc - 3.5) * SQUARE, 0, (dr - 3.5) * SQUARE);
}

/* Inverse of squareCenter: world (x,z) -> board (r,c), or null if outside the board. */
function worldToSquare(x, z, flipped) {
  const dc = Math.floor(x / SQUARE + 4);
  const dr = Math.floor(z / SQUARE + 4);
  if (dc < 0 || dc > 7 || dr < 0 || dr > 7) return null;
  const r = flipped ? 7 - dr : dr;
  const c = flipped ? 7 - dc : dc;
  return { r, c };
}

/* ==================== Scene / camera / lights ==================== */

function buildScene3D(container) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff3d6, 0x1a1408, 0.65));

  const key = new THREE.DirectionalLight(0xfff0d0, 1.15);
  key.position.set(3.5, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0025;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd6c8ff, 0.25);
  fill.position.set(-4, 3, -3);
  scene.add(fill);

  scene.add(buildBoardMesh());

  return { scene, camera, renderer };
}

function fitCamera(camera, containerWidth, containerHeight) {
  camera.aspect = containerWidth / containerHeight;
  camera.position.set(0, 9.4, 8.6);
  camera.lookAt(0, 0, -0.3);
  camera.updateProjectionMatrix();
}

/* ==================== Animation ==================== */

function tweenPosition(obj3d, toVec3, duration) {
  const from = obj3d.position.clone();
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    obj3d.position.lerpVectors(from, toVec3, eased);
    if (t < 1) requestAnimationFrame(step);
    else obj3d.position.copy(toVec3);
  }
  requestAnimationFrame(step);
}

/* ==================== Board3DController ====================
 * Mirrors BoardController's public interface (setGame, setFlipped, render,
 * applyExternalMove, .game/.selected/.legalTargets/.lastMove/.locked/.interactive/.onAfterMove)
 * so script.js can use either renderer interchangeably. */
class Board3DController {
  constructor(containerEl, { interactive = true, onAfterMove = null } = {}) {
    this.containerEl = containerEl;
    this.interactive = interactive;
    this.onAfterMove = onAfterMove;
    this.game = null;
    this.selected = null;
    this.legalTargets = [];
    this.lastMove = null;
    this.locked = false;
    this.flipped = false;
    this.pieceMeshes = new Map();
    this.highlightMeshes = [];

    containerEl.innerHTML = "";
    containerEl.style.position = "relative";

    const { scene, camera, renderer } = buildScene3D(containerEl);
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;cursor:pointer;";

    this._resize();
    this._resizeHandler = () => this._resize();
    window.addEventListener("resize", this._resizeHandler);

    renderer.domElement.addEventListener("click", (e) => this._onCanvasClick(e));

    this._raf = requestAnimationFrame(() => this._animate());
  }

  _resize() {
    const w = this.containerEl.clientWidth;
    const h = this.containerEl.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    fitCamera(this.camera, w, h);
  }

  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());
    if (this.containerEl.offsetWidth > 0) {
      this.renderer.render(this.scene, this.camera);
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

  /** Full instant rebuild from `this.game.board` — used for setGame, undo/redo and flips. */
  render() {
    for (const mesh of this.pieceMeshes.values()) this.scene.remove(mesh);
    this.pieceMeshes.clear();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.game.pieceAt(r, c);
        if (!piece) continue;
        const mesh = buildPieceMesh(piece.type, piece.color);
        mesh.position.copy(squareCenter(r, c, this.flipped));
        this.scene.add(mesh);
        this.pieceMeshes.set(`${r},${c}`, mesh);
      }
    }
    this._updateHighlights();
  }

  _updateHighlights() {
    for (const m of this.highlightMeshes) this.scene.remove(m);
    this.highlightMeshes = [];
    if (!this.game) return;

    const addDisc = (r, c, color, opacity, ring) => {
      const geo = ring ? new THREE.RingGeometry(0.40, 0.47, 32) : new THREE.CircleGeometry(0.14, 24);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide }));
      const pos = squareCenter(r, c, this.flipped);
      mesh.position.set(pos.x, 0.065, pos.z);
      this.scene.add(mesh);
      this.highlightMeshes.push(mesh);
    };

    if (this.lastMove) {
      addDisc(this.lastMove.from.r, this.lastMove.from.c, 0xd4af37, 0.45, true);
      addDisc(this.lastMove.to.r, this.lastMove.to.c, 0xd4af37, 0.45, true);
    }
    if (this.selected) addDisc(this.selected.r, this.selected.c, 0xd4af37, 0.95, true);
    for (const m of this.legalTargets) {
      if (m.capture) addDisc(m.to.r, m.to.c, 0xc0503f, 0.85, true);
      else addDisc(m.to.r, m.to.c, 0xd4af37, 0.65, false);
    }
    if (!this.game.isGameOver() && this.game.isInCheck(this.game.turn)) {
      const king = this.game.findKing(this.game.turn);
      if (king) addDisc(king.r, king.c, 0xc0503f, 0.95, true);
    }
  }

  _onCanvasClick(event) {
    if (!this.interactive || this.locked || !this.game || this.game.isGameOver()) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    const sq = worldToSquare(hit.x, hit.z, this.flipped);
    if (!sq) return;
    this._onSquareClick(sq.r, sq.c);
  }

  _onSquareClick(r, c) {
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
      this._updateHighlights();
    } else {
      this.selected = null;
      this.legalTargets = [];
      this._updateHighlights();
    }
  }

  _attemptMove(candidates) {
    if (candidates.length > 1) {
      this._askPromotion((promo) => {
        const chosen = candidates.find((m) => m.promotion === promo) || candidates[0];
        this._finalizeMove(chosen);
      });
      return;
    }
    this._finalizeMove(candidates[0]);
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

  _finalizeMove(moveInput) {
    const fromKey = `${moveInput.from.r},${moveInput.from.c}`;
    const toKey = `${moveInput.to.r},${moveInput.to.c}`;
    const wasOccupied = !!this.game.pieceAt(moveInput.to.r, moveInput.to.c);
    const movingColor = this.game.turn;

    const record = this.game.makeMove({ from: moveInput.from, to: moveInput.to, promotion: moveInput.promotion || null });
    if (!record) return;
    this.selected = null;
    this.legalTargets = [];
    this.lastMove = { from: moveInput.from, to: moveInput.to };

    const movingMesh = this.pieceMeshes.get(fromKey);

    if (record.capture) {
      let capturedKey = toKey;
      if (!wasOccupied) {
        const capR = movingColor === "w" ? moveInput.to.r + 1 : moveInput.to.r - 1;
        capturedKey = `${capR},${moveInput.to.c}`;
      }
      const capturedMesh = this.pieceMeshes.get(capturedKey);
      if (capturedMesh) {
        this.scene.remove(capturedMesh);
        this.pieceMeshes.delete(capturedKey);
      }
    }

    this.pieceMeshes.delete(fromKey);
    if (movingMesh) {
      if (record.promotion) {
        this.scene.remove(movingMesh);
        const promoted = buildPieceMesh(record.promotion, movingColor);
        promoted.position.copy(movingMesh.position);
        this.scene.add(promoted);
        this.pieceMeshes.set(toKey, promoted);
        tweenPosition(promoted, squareCenter(moveInput.to.r, moveInput.to.c, this.flipped), 380);
      } else {
        this.pieceMeshes.set(toKey, movingMesh);
        tweenPosition(movingMesh, squareCenter(moveInput.to.r, moveInput.to.c, this.flipped), 380);
      }
    }

    if (record.castle) {
      const rank = moveInput.from.r;
      const rookFromC = record.castle === "K" ? 7 : 0;
      const rookToC = record.castle === "K" ? 5 : 3;
      const rookFromKey = `${rank},${rookFromC}`;
      const rookToKey = `${rank},${rookToC}`;
      const rookMesh = this.pieceMeshes.get(rookFromKey);
      if (rookMesh) {
        this.pieceMeshes.delete(rookFromKey);
        this.pieceMeshes.set(rookToKey, rookMesh);
        tweenPosition(rookMesh, squareCenter(rank, rookToC, this.flipped), 380);
      }
    }

    this._updateHighlights();

    if (record.status === "check") SFX.check();
    else if (this.game.isGameOver()) SFX.end();
    else if (record.capture) SFX.capture();
    else SFX.move();
    if (this.onAfterMove) this.onAfterMove(record);
  }

  applyExternalMove(move) {
    this._finalizeMove({ from: move.from, to: move.to, promotion: move.promotion });
  }
}
