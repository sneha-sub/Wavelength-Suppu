import { DECKS } from "./decks.js";
import { TARGET_MIN, TARGET_MAX, scoreFor } from "./dial.js";

/* ══════════════════════════════════════════════════════════════
   Wavelength, cooperative rules (as in the official app):
   everyone is on the same side. Each round one player is the
   Psychic and sees the target; they give a clue and then go
   silent. Everyone else debates and moves one shared dial, then
   locks it in. The team banks 4 / 3 / 2 points by how close the
   dial lands. No teams, no rival score, no left-or-right guess.
   ══════════════════════════════════════════════════════════════ */

export const CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679"; // no lookalikes
export const randomCode = () =>
  Array.from({ length: 4 }, () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join("");

export const newId = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

export const MAX_PLAYERS = 12;

export function newRoom(code, hostId, hostName) {
  return {
    v: 1,
    code,
    createdAt: Date.now(),
    hostId,
    phase: "lobby",          // lobby | clue | guess | reveal | done
    players: [{ id: hostId, name: hostName, seenAt: Date.now() }],
    score: 0,
    decks: DECKS.map((d) => d.id),
    totalRounds: 8,
    round: 0,
    turn: 0,                 // psychic rotation cursor
    psychicId: null,
    deckId: null,
    card: null,
    target: 0.5,
    clue: "",
    dial: 0.5,
    dialBy: null,
    lockedBy: null,
    lastScore: null,
    used: [],
    reactSeq: 0,
    reactions: [],
    log: [],
  };
}

export const playerById = (room, id) => room.players.find((p) => p.id === id);

/** The best a group could possibly bank, for the end-of-game rating. */
export const maxScore = (room) => room.totalRounds * 4;

export function ratingFor(score, max) {
  const pct = max ? score / max : 0;
  if (pct >= 0.9) return "Telepathic";
  if (pct >= 0.75) return "Seriously in sync";
  if (pct >= 0.55) return "On the same wavelength";
  if (pct >= 0.35) return "Getting there";
  if (pct > 0) return "Crossed wires";
  return "Total static";
}

export function cardPool(room) {
  const used = new Set(room.used);
  const pool = [];
  DECKS.filter((d) => room.decks.includes(d.id)).forEach((d) =>
    d.cards.forEach((c, i) => {
      const key = `${d.id}:${i}`;
      if (!used.has(key)) pool.push({ deckId: d.id, card: c, key });
    })
  );
  return pool;
}

/** A fresh scale every round, spread evenly across the decks in play.
 *  Drawing uniformly from the whole pool would happily give three cards
 *  from one deck and none from another over a short game, so take from
 *  whichever deck has come up least so far. */
export function dealCard(room) {
  let pool = cardPool(room);
  if (!pool.length) {
    room.used = [];
    pool = cardPool(room);
  }

  const dealt = {};
  room.decks.forEach((id) => { dealt[id] = 0; });
  room.used.forEach((k) => {
    const id = k.split(":")[0];
    if (id in dealt) dealt[id]++;
  });

  const available = [...new Set(pool.map((p) => p.deckId))];
  const fewest = Math.min(...available.map((id) => dealt[id] ?? 0));
  const dueDecks = available.filter((id) => (dealt[id] ?? 0) === fewest);
  const deckId = dueDecks[Math.floor(Math.random() * dueDecks.length)];

  const fromDeck = pool.filter((p) => p.deckId === deckId);
  const pick = fromDeck[Math.floor(Math.random() * fromDeck.length)];
  room.used.push(pick.key);
  room.deckId = pick.deckId;
  room.card = pick.card;
  room.target = TARGET_MIN + Math.random() * (TARGET_MAX - TARGET_MIN);

  room.clue = "";
  room.dial = 0.5;
  room.dialBy = null;
  room.lockedBy = null;
  room.lastScore = null;
  room.phase = "clue";
}

/** Rotate the Psychic through everyone in turn, then deal them a card. */
export function dealRound(room) {
  room.psychicId = room.players.length
    ? room.players[room.turn % room.players.length].id
    : null;
  room.turn++;
  dealCard(room);
}

/* ---------- what each phone is allowed to see ----------
   The target must never reach anyone but the Psychic before the
   reveal, or the game is trivially cheatable. */
export function viewFor(room, viewerId) {
  const me = playerById(room, viewerId) || null;
  const isPsychic = Boolean(viewerId) && viewerId === room.psychicId;
  const showTarget = isPsychic || room.phase === "reveal" || room.phase === "done";

  return {
    v: room.v,
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
    score: room.score,
    maxScore: maxScore(room),
    rating: ratingFor(room.score, maxScore(room)),
    decks: room.decks,
    totalRounds: room.totalRounds,
    round: room.round,
    psychicId: room.psychicId,
    deckId: room.deckId,
    card: room.card,
    clue: room.clue,
    dial: room.dial,
    dialBy: room.dialBy,
    lastScore: room.lastScore,
    reactions: room.reactions.slice(-12),
    target: showTarget ? room.target : null,
    me,
    isHost: viewerId === room.hostId,
    isPsychic,
  };
}

/* ---------- actions ---------- */
export function applyAction(room, { type, playerId, payload = {} }) {
  const me = playerById(room, playerId);
  if (!me) return { error: "not_in_room" };
  const isHost = playerId === room.hostId;
  const isPsychic = playerId === room.psychicId;

  switch (type) {
    case "ping":
      me.seenAt = Date.now();
      return {};

    case "setDecks": {
      if (!isHost) return { error: "not_host" };
      const ids = (payload.decks || []).filter((d) => DECKS.some((x) => x.id === d));
      if (!ids.length) return { error: "need_deck" };
      room.decks = ids;
      return {};
    }

    case "setRounds":
      if (!isHost) return { error: "not_host" };
      room.totalRounds = [4, 6, 8, 10, 12].includes(payload.rounds) ? payload.rounds : 8;
      return {};

    case "kick": {
      if (!isHost) return { error: "not_host" };
      if (payload.playerId === room.hostId) return { error: "cannot_kick_host" };
      room.players = room.players.filter((p) => p.id !== payload.playerId);
      return {};
    }

    case "start": {
      if (!isHost) return { error: "not_host" };
      if (room.phase !== "lobby" && room.phase !== "done") return { error: "already_started" };
      if (room.players.length < 2) return { error: "need_two" };
      room.score = 0;
      room.turn = 0;
      room.used = [];
      room.log = [];
      room.round = 1;
      dealRound(room);
      return {};
    }

    case "newCard":
      if (!isPsychic) return { error: "not_psychic" };
      if (room.phase !== "clue") return { error: "wrong_phase" };
      dealCard(room);
      return {};

    case "clue": {
      if (!isPsychic) return { error: "not_psychic" };
      if (room.phase !== "clue") return { error: "wrong_phase" };
      const text = String(payload.clue || "").trim().slice(0, 60);
      if (!text) return { error: "empty_clue" };
      room.clue = text;              // shown exactly as the Psychic typed it
      room.phase = "guess";
      return {};
    }

    case "dial": {
      if (room.phase !== "guess") return { error: "wrong_phase" };
      if (isPsychic) return { error: "psychic_silent" };
      const v = Number(payload.dial);
      if (!Number.isFinite(v)) return { error: "bad_value" };
      room.dial = Math.min(0.978, Math.max(0.022, v));
      room.dialBy = playerId;
      return {};
    }

    case "lock": {
      if (room.phase !== "guess") return { error: "wrong_phase" };
      if (isPsychic) return { error: "psychic_silent" };
      const pts = scoreFor(room.dial, room.target);
      room.score += pts;
      room.lockedBy = playerId;
      room.lastScore = { pts, by: me.name };
      room.log.push({
        round: room.round,
        deckId: room.deckId,
        card: room.card,
        clue: room.clue,
        psychic: playerById(room, room.psychicId)?.name || "",
        target: room.target,
        dial: room.dial,
        pts,
      });
      room.phase = "reveal";
      return {};
    }

    case "next":
      if (room.phase !== "reveal") return { error: "wrong_phase" };
      if (room.round >= room.totalRounds) {
        room.phase = "done";
        return {};
      }
      room.round++;
      dealRound(room);
      return {};

    case "backToLobby":
      if (!isHost) return { error: "not_host" };
      room.phase = "lobby";
      return {};

    case "react":
      room.reactSeq++;
      room.reactions.push({
        id: String(payload.reaction || "").slice(0, 12),
        by: playerId,
        name: me.name,
        n: room.reactSeq,
      });
      if (room.reactions.length > 12) room.reactions = room.reactions.slice(-12);
      return {};

    default:
      return { error: "unknown_action" };
  }
}
