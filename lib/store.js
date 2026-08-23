import { Redis } from "@upstash/redis";

/* The Vercel Upstash integration provisions KV_REST_API_* ; a raw Upstash
   project provisions UPSTASH_REDIS_REST_* . Accept either. */
/* Integrations name these differently depending on how the store was
   created (Vercel KV, the Upstash marketplace integration, or a manual
   Upstash project), so accept every spelling we might be handed. */
const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_URL ||
  process.env.STORAGE_REST_API_URL;
const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN ||
  process.env.STORAGE_REST_API_TOKEN;

const hasRedis = Boolean(url && token);
const isProd = process.env.NODE_ENV === "production";

/* Local development only. A single-process Map is fine for `next dev`, but
   it would silently drop games on serverless, so production always requires
   a real Redis. */
/* Hung off globalThis because Next's dev server gives each route its own
   module instance — a plain module-level Map would not be shared. */
globalThis.__wlMemory ||= new Map();
const memory = globalThis.__wlMemory;
const useMemory = !hasRedis && !isProd;

export const storeReady = hasRedis || useMemory;

const redis = hasRedis ? new Redis({ url, token }) : null;

const KEY = (code) => `wl:room:${code}`;
const TTL = 60 * 60 * 12; // a room lives for 12 hours

/* Compare-and-set on the room's version, so two phones acting in the same
   instant can never clobber each other. */
const CAS = `
local cur = redis.call('GET', KEYS[1])
if cur then
  local ok, obj = pcall(cjson.decode, cur)
  if ok and tonumber(obj.v) ~= tonumber(ARGV[2]) then return 0 end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[3]))
return 1
`;

export async function readRoom(code) {
  if (useMemory) {
    const raw = memory.get(KEY(code));
    return raw ? JSON.parse(raw) : null;
  }
  if (!redis) return null;
  const raw = await redis.get(KEY(code));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

/** Create only if the code is free. */
export async function createRoom(code, state) {
  if (useMemory) {
    if (memory.has(KEY(code))) return false;
    memory.set(KEY(code), JSON.stringify(state));
    return true;
  }
  if (!redis) throw new Error("store_unavailable");
  return (await redis.set(KEY(code), JSON.stringify(state), { ex: TTL, nx: true })) === "OK";
}

/** Write only if the stored version still matches `expectedV`. */
export async function casRoom(code, state, expectedV) {
  if (useMemory) {
    const cur = memory.get(KEY(code));
    if (cur && JSON.parse(cur).v !== expectedV) return false;
    memory.set(KEY(code), JSON.stringify(state));
    return true;
  }
  if (!redis) throw new Error("store_unavailable");
  const res = await redis.eval(CAS, [KEY(code)], [JSON.stringify(state), String(expectedV), String(TTL)]);
  return Number(res) === 1;
}

/** Read → mutate → write, retrying if another phone got there first. */
export async function mutate(code, fn, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const room = await readRoom(code);
    if (!room) return { error: "no_room" };
    const expected = room.v;
    const result = fn(room);
    if (result && result.error) return result;
    room.v = expected + 1;
    if (await casRoom(code, room, expected)) return { room };
    await new Promise((r) => setTimeout(r, 25 + i * 35));
  }
  return { error: "busy" };
}
