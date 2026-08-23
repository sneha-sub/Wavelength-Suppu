import { storeReady } from "../../../lib/store.js";
import { json } from "../../../lib/http.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* Diagnostic only. Reports which database environment variables exist by
   NAME so a misnamed or missing binding can be spotted from outside.
   Values are never read or returned. */
export async function GET() {
  const seen = Object.keys(process.env)
    .filter((k) => /^(KV_|UPSTASH_|REDIS)/.test(k))
    .sort();

  return json({
    storeReady,
    reads: ["KV_REST_API_URL / KV_REST_API_TOKEN",
            "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN"],
    present: seen,
    vercelEnv: process.env.VERCEL_ENV || null,
  });
}
