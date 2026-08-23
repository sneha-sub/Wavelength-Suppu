import { mutate, storeReady } from "../../../lib/store.js";
import { newId, viewFor, MAX_PLAYERS } from "../../../lib/game.js";
import { json, fail } from "../../../lib/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req) {
  if (!storeReady) return fail("store_unavailable", 503);
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase();
  const name = String(body.name || "").trim().slice(0, 14);
  if (!code || !name) return fail("bad_request");

  const playerId = newId();
  const res = await mutate(code, (room) => {
    /* Rejoining with the same name reclaims your seat — phones lock and
       browsers get closed, and nobody should be stranded mid-game. */
    const existing = room.players.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      const wasPsychic = room.psychicId === existing.id;
      existing.id = playerId;
      if (wasPsychic) room.psychicId = playerId;
      return {};
    }
    if (room.phase !== "lobby") return { error: "already_started" };
    if (room.players.length >= MAX_PLAYERS) return { error: "room_full" };
    room.players.push({ id: playerId, name, seenAt: Date.now() });
    return {};
  });

  if (res.error) return fail(res.error, res.error === "no_room" ? 404 : 409);
  return json({ code, playerId, view: viewFor(res.room, playerId) });
}
