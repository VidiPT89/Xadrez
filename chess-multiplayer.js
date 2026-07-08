/* Multiplayer networking layer: rooms, moves, chat and presence over Firestore.
 * Exposes a small event-driven API on window.MP; script.js is the only other file that touches
 * BoardController, so this module never reaches into the DOM. */
import { auth, db, configured, ensureSignedIn } from "./firebase-init.js?v=20260709";
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc,
  query, orderBy, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — avoids transcription errors
const PRESENCE_HEARTBEAT_MS = 20000;
const PRESENCE_STALE_MS = 45000;

function randomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

const state = {
  roomCode: null,
  myUid: null,
  myColor: null,
  role: null, // "host" | "guest"
  appliedPly: -1,
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
  onGameFinished: null,      // (result: string) => void — e.g. "resign-w"
  onError: null,             // (err) => void
  get myColor() { return state.myColor; },
  get roomCode() { return state.roomCode; },
  get myUid() { return state.myUid; },
};

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
    if (data.status === "finished" && data.result && MP.onGameFinished) MP.onGameFinished(data.result);
    state.lastOppPresence = state.role === "host" ? data.guestPresence : data.hostPresence;
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
      if (change.type !== "added") return;
      const d = change.doc.data();
      if (d.ply <= state.appliedPly) return;
      state.appliedPly = d.ply;
      if (d.by === state.myUid) return; // my own move, applied locally already when I made it
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
      if (MP.onChat) MP.onChat({ uid: d.uid, text: d.text, mine: d.uid === state.myUid });
    });
  });
}

function presenceField() { return state.role === "host" ? "hostPresence" : "guestPresence"; }

function sendHeartbeat(online) {
  if (!state.roomCode) return;
  updateDoc(doc(db, "rooms", state.roomCode), {
    [presenceField()]: { online, lastSeen: serverTimestamp() },
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
        guestPresence: { online: true, lastSeen: serverTimestamp() },
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

  state.roomCode = code;
  state.appliedPly = -1;
  state.sawGuest = !!data.guestUid || state.role === "guest";
  state.opponentOnline = false;
  state.lastOppPresence = null;
  attachRoomListener();
  attachMovesListener();
  attachChatListener();
  startPresenceHeartbeat();
  return { code, myColor: state.myColor, role: state.role };
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
      await setDoc(ref, {
        hostUid: myUid,
        hostColor: "w",
        guestUid: null,
        status: "waiting",
        result: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        hostPresence: { online: true, lastSeen: serverTimestamp() },
        guestPresence: { online: false, lastSeen: serverTimestamp() },
      });
    } catch (err) {
      continue;
    }
    return joinRoom(code);
  }
  throw new Error("room-create-failed");
}

export async function sendMove({ from, to, promotion }) {
  if (!state.roomCode) return;
  const ply = state.appliedPly + 1;
  const plyId = String(ply).padStart(4, "0");
  try {
    await setDoc(doc(db, "rooms", state.roomCode, "moves", plyId), {
      ply, from, to, promotion: promotion || null, by: state.myUid, playedAt: serverTimestamp(),
    });
  } catch (err) {
    if (MP.onError) MP.onError(err);
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
  state.opponentOnline = false;
  state.lastOppPresence = null;
  state.sawGuest = false;
}

Object.assign(MP, { createRoom, joinRoom, sendMove, sendChat, resign, leaveRoom });
window.MP = MP;
window.dispatchEvent(new CustomEvent("mp-ready"));
