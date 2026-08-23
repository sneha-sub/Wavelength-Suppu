# Wavelength — Suppu Edition

A web app. Everyone opens the same page on their own phone, joins with a
four-letter room code, and plays.

**Fully cooperative, like the official Wavelength app.** There are no teams.
Each round one player is the Psychic: they alone see the target on the dial,
give a one-line clue, and then go silent. Everyone else argues and drags one
shared dial, live on all phones, until someone locks it in. The group banks
4, 3 or 2 points by how close it lands, and you're chasing one shared total
(4 x the round count) plus a rating at the end.

## Play right now, on real phones, no deploy

    npm install
    npm run dev:lan

Then on every phone (same wifi as this laptop):

    http://192.168.1.24:3131

One person taps **Start a new game** and reads out the code; everyone else
taps **Join a game**. This uses an in-memory store, so the game resets if the
laptop sleeps or the server restarts — fine for testing, not for the party.

## Deploy for the party

The repo is linked to Vercel and deploys on every push to `dev`. The
Next.js app sits at the repo root, so Vercel auto-detects it and the
project's **Root Directory** setting must stay **empty**.

1. Add the database. In the Vercel dashboard, open the project →
   **Storage** → **Create Database** → **Upstash for Redis** → connect it to
   this project. Free tier is far more than enough.

   The app reads `KV_REST_API_URL` / `KV_REST_API_TOKEN` (what the Vercel
   integration sets) or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

2. Redeploy so the app picks up the new variables (Deployments -> ... -> Redeploy).

Without a database, production returns "The game database isn't connected
yet" rather than silently losing games mid-round.

## Vercel setup

The repo is linked to Vercel and deploys on every push to `dev`. Three
things had to be true, and all three are now pinned in the repo rather
than in dashboard fields:

- **The app lives at the repo root.** Vercel's **Root Directory** setting
  must stay **empty**. Putting the app in a subfolder was what made the
  site serve `dosa.png` instead of the game.
- **`vercel.json` declares `"framework": "nextjs"`.** Without it the
  project fell back to the "Other" preset, whose output directory is
  `public/` — so builds succeeded, `.next` was ignored, and `/` returned
  404 while `/dosa.png` returned 200.
- **`distDir` is always `.next`.** Never key it off `NODE_ENV`: Vercel
  builds with `NODE_ENV=production`, so that sends output somewhere Vercel
  does not look. Use `npm run build:local` for a build that keeps out of a
  running dev server's way.

Environment variables are bound when a deployment is built, so after
connecting or changing the database you must redeploy for the app to see
the new credentials.

## Editing the content

- **Spectrums and decks** — `lib/decks.js`. Each card is `{ l, r }`: the left
  and right ends of the dial.
- **Reactions** — also `lib/decks.js`. They're placeholder emoji. To use custom
  art, swap `emoji: "🔥"` for `img: "/reactions/fire.png"` and drop the file in
  `public/reactions/`. Both the bar and the floating animation already handle
  images.
- **Colours and type** — `app/globals.css`, all at the top.

## The dosa

`public/dosa.png` is your file, byte for byte. Nothing redraws it. The scale
wedge is an SVG overlay on a 402×481 grid that matches the PNG's own pixels,
pivoting on (201.5, 235.5) — the exact centre of the circle, which is also the
banana-leaf horizon. Wedge band widths come from `scale.png`.

## Tests

    node test/api.test.mjs

41 checks against a running server: the Psychic held to silence, phase
gating, the target never leaking to a phone that shouldn't see it, one shared
dial and one shared score, a fresh scale every round, Psychic rotation, and
eight phones writing at once.
