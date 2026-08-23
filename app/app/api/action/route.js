import { mutate, storeReady } from "../../../lib/store.js";
import { applyAction, viewFor } from "../../../lib/game.js";
import { json, fail } from "../../../lib/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req) {
  if (!storeReady) return fail("store_unavailable", 503);
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").toUpperCase();
  const playerId = String(body.playerId || "");
  if (!code || !playerId || !body.type) return fail("bad_request");

  const res = await mutate(code, (room) =>
    applyAction(room, { type: body.type, playerId, payload: body.payload || {} })
  );

  if (res.error) return fail(res.error, res.error === "no_room" ? 404 : 409);
  return json({ view: viewFor(res.room, playerId) });
}
