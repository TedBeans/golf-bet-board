# Bet Board

A shareable, live golf-bet tracker. Anyone with the link can watch it update.
Only someone with the passcode can edit it.

## Deploy it (about 10 minutes, no coding required)

### 1. Put the code on GitHub
- Go to github.com → New repository → name it `golf-bet-board` → Create.
- On your computer, unzip this project, then in a terminal inside the folder run:
  ```
  git init
  git add .
  git commit -m "bet board"
  git branch -M main
  git remote add origin https://github.com/YOUR_USERNAME/golf-bet-board.git
  git push -u origin main
  ```
  (Replace YOUR_USERNAME with your GitHub username.)

### 2. Import it into Vercel
- Go to vercel.com → sign in (GitHub login is easiest) → **Add New → Project**.
- Pick the `golf-bet-board` repo → Deploy. It'll fail the first time because
  there's no database yet — that's expected, continue to step 3.

### 3. Add the shared database (Upstash, free tier)
- In your new Vercel project, go to **Storage** → **Create Database** (or
  **Marketplace**) → choose **Upstash** → Redis → Create.
- Connect it to this project. Vercel will automatically add the
  `KV_REST_API_URL` / `KV_REST_API_TOKEN` env vars for you.
  (If it names them differently, e.g. `UPSTASH_REDIS_REST_URL`, that's fine —
  `lib/redis.ts` already checks both naming patterns.)

### 4. Set your passcode
- In the project's **Settings → Environment Variables**, add:
  - `EDIT_PASSCODE` = something only you know (e.g. `birdie23`)
- Redeploy (Vercel → Deployments → ⋯ → Redeploy) so the new env vars take effect.

### 5. Share it
- Vercel gives you a URL like `golf-bet-board.vercel.app`. Send that to your
  friends — they'll see the board update live, read-only.
- You visit the same link, type your passcode into the small box next to the
  status pills, hit Unlock, and you can update stat/thru/status. It stays
  unlocked on your device until you clear the browser session.

## Notes
- Each round's slate is seeded once (see `lib/seed.ts`) and then lives in the
  shared Redis store — everyone always sees the same data.
- To load a new round or tournament, edit `lib/seed.ts` and either delete the
  Redis key `golf-bet-board:bets` from your Upstash dashboard (it'll reseed on
  next load) or push updated code.
