import { readRoom, storeReady } from "../../../lib/store.js";
import { viewFor } from "../../../lib/game.js";
import { json, fail } from "../../../lib/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req) {
  if (!storeReady) return fail("store_unavailable", 503);
  const u = new URL(req.url);
  const code = String(u.searchParams.get("code") || "").toUpperCase();
  const pid = u.searchParams.get("pid") || "";
  const since = Number(u.searchParams.get("v") || 0);

  const room = await readRoom(code);
  if (!room) return fail("no_room", 404);
  if (since && room.v === since) return json({ same: true, v: room.v });
  return json({ view: viewFor(room, pid) });
}
