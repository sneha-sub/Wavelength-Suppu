export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const fail = (code, status = 400) => json({ error: code }, status);

/** Plain-language messages for everything the game can reject. */
export const MESSAGES = {
  no_room: "That code doesn't match a game. Check the four letters and try again.",
  store_unavailable: "The game database isn't connected yet.",
  room_full: "This game is full at 12 players.",
  already_started: "That game has already started.",
  need_two: "You need at least two players to start.",
  need_deck: "Keep at least one deck in play.",
  not_host: "Only the host can change that.",
  not_psychic: "Only the psychic can do that.",
  psychic_silent: "You're the psychic this round — no nudging the dial.",
  wrong_phase: "That already happened. Your screen will catch up.",
  not_in_room: "You've been removed from this game.",
  empty_clue: "Type your clue first.",
  bad_request: "Something was missing from that request.",
  busy: "Everyone tapped at once. Try that again.",
};
