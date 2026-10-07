/* Multiplayer networking layer: rooms, moves, chat and presence over Firestore.
 * Exposes a small event-driven API on window.MP; script.js is the only other file that touches
 * BoardController, so this module never reaches into the DOM. */
import { auth, db, configured, ensureSignedIn } from "./firebase-init.js?v=20261007c";
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc,
  query, orderBy, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — avoids transcription errors
const PRESENCE_HEARTBEAT_MS = 20000;
const PRESENCE_STALE_MS = 45000;
// Fixed pool of public "Quick Play" rooms — always exist (or get recycled once finished), so
// tapping Quick Play never requires coordinating a code with anyone.
const LOBBY_CODES = ["LOBBYA", "LOBBYB", "LOBBYC"];

function randomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

export const MAX_NAME_LENGTH = 20;

/** Trims, collapses whitespace and drops control characters; "" when nothing usable is left. */
export function cleanName(raw) {
  return String(raw || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

const state = {
  roomCode: null,
  myName: "",
  opponentName: "",
  myUid: null,
  myColor: null,
  role: null, // "host" | "guest"
  appliedPly: -1,
  sentPlies: new Set(), // plies this session wrote — only those are already on the local board
  roomCreatedAtMs: 0, // lobby rooms get recycled; docs older than this belong to a previous game
  finishedNotified: false,
  unsubRoom: null,
  unsubMoves: null,
  unsubChat: null,
  heartbeatTimer: null,
  staleCheckTimer: null,
  opponentOnline: false,
  lastOppPresence: null,
  sawGuest: false,
};

export const MP = {
  configured,
  onRemoteMove: null,       // (move: {from,to,promotion}) => void
  onChat: null,              // (message: {uid,text,mine}) => void
  onOpponentJoined: null,    // () => void — fires once, for the host, when a guest claims the room
  onOpponentPresence: null,  // (online: boolean) => void
  onGameFinished: null,      // (result: string) => void — "resign-w", or a rules ending like "checkmate-b"
  onOpponentName: null,      // (name: string) => void — "" until the opponent's client sends one
  get myColor() { return state.myColor; },
  get roomCode() { return state.roomCode; },
  get opponentOnline() { return state.opponentOnline; },
  get opponentName() { return state.opponentName; },
  get myName() { return state.myName; },
};

/** True for docs written before the current game began (left behind in a recycled room). A null
 * timestamp is a still-pending local write, which is by definition current. */
function isStale(ts) {
  return !!(ts && ts.toMillis && ts.toMillis() < state.roomCreatedAtMs);
}

function isFresh(ts) {
  if (!ts || !ts.toMillis) return false;
  return Date.now() - ts.toMillis() < PRESENCE_STALE_MS;
}

function recomputePresence() {
  const online = !!(state.lastOppPresence && state.lastOppPresence.online && isFresh(state.lastOppPresence.lastSeen));
  if (online !== state.opponentOnline) {
    state.opponentOnline = online;
    if (MP.onOpponentPresence) MP.onOpponentPresence(online);
  }
}

function attachRoomListener() {
  if (state.unsubRoom) state.unsubRoom();
  const ref = doc(db, "rooms", state.roomCode);
  state.unsubRoom = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.guestUid && !state.sawGuest) {
      state.sawGuest = true;
      if (MP.onOpponentJoined) MP.onOpponentJoined();
    }
    if (data.status === "finished" && data.result && !state.finishedNotified) {
      state.finishedNotified = true;
      if (MP.onGameFinished) MP.onGameFinished(data.result);
    }
    state.lastOppPresence = state.role === "host" ? data.guestPresence : data.hostPresence;
    // The name rides inside the presence map (the room's security rules reject new top-level
    // fields). Older clients rewrite presence without it, so keep the last name we saw.
    const oppName = cleanName(state.lastOppPresence && state.lastOppPresence.name);
    if (oppName && oppName !== state.opponentName) {
      state.opponentName = oppName;
      if (MP.onOpponentName) MP.onOpponentName(oppName);
    }
    recomputePresence();
  });
  if (state.staleCheckTimer) clearInterval(state.staleCheckTimer);
  state.staleCheckTimer = setInterval(recomputePresence, 8000);
}

function attachMovesListener() {
  if (state.unsubMoves) state.unsubMoves();
  const movesCol = collection(db, "rooms", state.roomCode, "moves");
  state.unsubMoves = onSnapshot(query(movesCol, orderBy("ply")), (snap) => {
    snap.docChanges().forEach((change) => {
      // "modified" too: in a recycled room a new move can overwrite an old game's doc for that ply.
      if (change.type === "removed") return;
      const d = change.doc.data();
      if (d.ply <= state.appliedPly || isStale(d.playedAt)) return;
      state.appliedPly = d.ply;
      // My own move from this session is already on the board; after a reload it isn't, so replay it.
      if (state.sentPlies.has(d.ply)) return;
      if (MP.onRemoteMove) MP.onRemoteMove({ from: d.from, to: d.to, promotion: d.promotion || null });
    });
  });
}

function attachChatListener() {
  if (state.unsubChat) state.unsubChat();
  const chatCol = collection(db, "rooms", state.roomCode, "chat");
  state.unsubChat = onSnapshot(query(chatCol, orderBy("sentAt")), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type !== "added") return;
      const d = change.doc.data();
      if (isStale(d.sentAt)) return;
      if (MP.onChat) MP.onChat({ uid: d.uid, text: d.text, mine: d.uid === state.myUid });
    });
  });
}

function presenceField() { return state.role === "host" ? "hostPresence" : "guestPresence"; }

function presenceValue(online) {
  const value = { online, lastSeen: serverTimestamp() };
  if (state.myName) value.name = state.myName;
  return value;
}

function sendHeartbeat(online) {
  if (!state.roomCode) return;
  updateDoc(doc(db, "rooms", state.roomCode), {
    [presenceField()]: presenceValue(online),
    updatedAt: serverTimestamp(),
  }).catch(() => {});
}

function startPresenceHeartbeat() {
  sendHeartbeat(true);
  if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = setInterval(() => sendHeartbeat(true), PRESENCE_HEARTBEAT_MS);
  window.addEventListener("beforeunload", markOffline);
}

function markOffline() { sendHeartbeat(false); }

async function enterRoom(code, data) {
  const myUid = state.myUid;
  if (data.hostUid === myUid) {
    state.role = "host";
    state.myColor = data.hostColor;
  } else if (data.guestUid === myUid) {
    state.role = "guest";
    state.myColor = data.hostColor === "w" ? "b" : "w";
  } else if (!data.guestUid) {
    if (data.status === "finished") throw new Error("room-finished");
    try {
      await updateDoc(doc(db, "rooms", code), {
        guestUid: myUid,
        status: "active",
        guestPresence: presenceValue(true),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      throw new Error("room-full");
    }
    state.role = "guest";
    state.myColor = data.hostColor === "w" ? "b" : "w";
  } else {
    throw new Error("room-full");
  }

  // Read back the stored createdAt (a server timestamp) so listeners can skip leftovers from a
  // previous game in this room.
  const fresh = await getDoc(doc(db, "rooms", code)).catch(() => null);
  const createdAt = fresh && fresh.exists() ? fresh.data().createdAt : null;
  state.roomCreatedAtMs = createdAt && createdAt.toMillis ? createdAt.toMillis() : 0;

  state.roomCode = code;
  state.appliedPly = -1;
  state.sentPlies = new Set();
  state.finishedNotified = false;
  state.opponentName = "";
  state.sawGuest = !!data.guestUid || state.role === "guest";
  state.opponentOnline = false;
  state.lastOppPresence = null;
  attachRoomListener();
  attachMovesListener();
  attachChatListener();
  startPresenceHeartbeat();
  return { code, myColor: state.myColor, role: state.role };
}

function freshRoomDoc(hostUid) {
  return {
    hostUid,
    hostColor: "w",
    guestUid: null,
    status: "waiting",
    result: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    hostPresence: presenceValue(true),
    guestPresence: { online: false, lastSeen: serverTimestamp() },
  };
}

export async function joinRoom(code) {
  await ensureSignedIn();
  state.myUid = auth.currentUser.uid;
  const ref = doc(db, "rooms", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("room-not-found");
  return enterRoom(code, snap.data());
}

export async function createRoom() {
  await ensureSignedIn();
  const myUid = auth.currentUser.uid;
  state.myUid = myUid;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const ref = doc(db, "rooms", code);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;
    try {
      await setDoc(ref, freshRoomDoc(myUid));
    } catch (err) {
      continue;
    }
    return joinRoom(code);
  }
  throw new Error("room-create-failed");
}

/** Joins (or claims/recycles) the first available room in the fixed public lobby pool, so two
 * people can play without coordinating a code: whoever arrives first waits as host, whoever
 * arrives second joins immediately as guest and the game starts right away. */
export async function quickPlay() {
  if (!configured) throw new Error("not-configured");
  await ensureSignedIn();
  const myUid = auth.currentUser.uid;
  state.myUid = myUid;
  for (const code of LOBBY_CODES) {
    const ref = doc(db, "rooms", code);
    const snap = await getDoc(ref).catch(() => null);
    const data = snap && snap.exists() ? snap.data() : null;

    if (!data || data.status === "finished") {
      try {
        await setDoc(ref, freshRoomDoc(myUid));
      } catch (err) {
        continue; // someone else claimed/recycled this slot first — try the next one
      }
      return enterRoom(code, freshRoomDoc(myUid));
    }
    if (data.hostUid === myUid || data.guestUid === myUid) {
      return enterRoom(code, data); // reconnecting to my own quick-play game
    }
    if (data.status === "waiting" && !data.guestUid) {
      return enterRoom(code, data); // joins as guest, starts immediately
    }
    // Occupied by two other players — try reclaiming it in case it's actually an abandoned
    // game (both sides have been offline a while). The security rules are the real arbiter:
    // this write only succeeds if both presences are genuinely stale server-side.
    try {
      await setDoc(ref, freshRoomDoc(myUid));
      return enterRoom(code, freshRoomDoc(myUid));
    } catch (err) {
      continue; // still genuinely occupied — try the next pool slot
    }
  }
  throw new Error("lobby-full");
}

export async function sendMove({ from, to, promotion }) {
  if (!state.roomCode) return;
  const ply = state.appliedPly + 1;
  const plyId = String(ply).padStart(4, "0");
  state.sentPlies.add(ply);
  try {
    await setDoc(doc(db, "rooms", state.roomCode, "moves", plyId), {
      ply, from, to, promotion: promotion || null, by: state.myUid, playedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Multiplayer: failed to send move", err);
  }
}

export async function sendChat(text) {
  if (!state.roomCode) return;
  const trimmed = String(text).trim().slice(0, 300);
  if (!trimmed) return;
  await addDoc(collection(db, "rooms", state.roomCode, "chat"), {
    uid: state.myUid, text: trimmed, sentAt: serverTimestamp(),
  });
}

export async function resign() {
  if (!state.roomCode || !state.myColor) return;
  await updateDoc(doc(db, "rooms", state.roomCode), {
    status: "finished", result: "resign-" + state.myColor, updatedAt: serverTimestamp(),
  });
}

/** Marks the room finished after a rules ending (e.g. "checkmate-w", "stalemate", "draw-50"), so a
 * Quick Play slot frees up at once instead of waiting for both presences to go stale. */
export async function finishGame(result) {
  if (!state.roomCode) return;
  await updateDoc(doc(db, "rooms", state.roomCode), {
    status: "finished", result, updatedAt: serverTimestamp(),
  }).catch((err) => console.error("Multiplayer: failed to mark the game finished", err));
}

export function leaveRoom() {
  markOffline();
  if (state.unsubRoom) state.unsubRoom();
  if (state.unsubMoves) state.unsubMoves();
  if (state.unsubChat) state.unsubChat();
  if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
  if (state.staleCheckTimer) clearInterval(state.staleCheckTimer);
  window.removeEventListener("beforeunload", markOffline);
  state.roomCode = null;
  state.role = null;
  state.myColor = null;
  state.appliedPly = -1;
  state.sentPlies = new Set();
  state.roomCreatedAtMs = 0;
  state.finishedNotified = false;
  state.opponentName = "";
  state.opponentOnline = false;
  state.lastOppPresence = null;
  state.sawGuest = false;
}

export function setName(name) {
  state.myName = cleanName(name);
}

Object.assign(MP, { setName, createRoom, joinRoom, quickPlay, sendMove, sendChat, resign, finishGame, leaveRoom });
window.MP = MP;
window.dispatchEvent(new CustomEvent("mp-ready"));
