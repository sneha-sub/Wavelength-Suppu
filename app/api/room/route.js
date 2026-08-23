import { createRoom, storeReady } from "../../../lib/store.js";
import { newRoom, randomCode, newId, viewFor } from "../../../lib/game.js";
import { json, fail } from "../../../lib/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req) {
  if (!storeReady) return fail("store_unavailable", 503);
  const { name } = await req.json().catch(() => ({}));
  const hostName = String(name || "").trim().slice(0, 14);
  if (!hostName) return fail("empty_name");

  const hostId = newId();
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    const room = newRoom(code, hostId, hostName);
    if (await createRoom(code, room)) {
      return json({ code, playerId: hostId, view: viewFor(room, hostId) });
    }
  }
  return fail("busy", 503);
}
