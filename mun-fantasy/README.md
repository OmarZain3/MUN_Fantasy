# MUN Fantasy League (monorepo)

Production-style fantasy match-day system with a React client, Express API, PostgreSQL, Prisma, JWT auth, and Socket.IO live updates.

## Folder structure

```
mun-fantasy/
  README.md
  backend/
    package.json
    prisma/
      schema.prisma
      migrations/
      seed.ts
    seed/
      teams/
        mun/players.json
        aisec/players.json
        … (one folder per team)
    src/
      app.ts
      index.ts
      config/
      constants/
      lib/
      middleware/
      routes/
      services/
      types/
    .env.example
  frontend/
    package.json
    vite.config.ts
    tailwind.config.js
    postcss.config.js
    src/
      App.tsx
      main.tsx
      index.css
      components/
      pages/
      lib/
      store/
      types.ts
    .env.example
```

## CI (GitHub Actions)

On push/PR to `main` or `master`, **`.github/workflows/ci.yml`** runs:

- **Backend:** `npm ci` → `prisma generate` → Typecheck `src` + `prisma/seed.ts`
- **Frontend:** `npm ci` → `vite build`

Locally from repo root:

```powershell
cd mun-fantasy
npm run ci
```

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## Backend

From **`mun-fantasy/backend`** (or use the same commands from **`mun-fantasy`** — the root `package.json` forwards `db:seed`, Prisma, and `dev:*` to the right package):

```powershell
cd mun-fantasy/backend
Copy-Item .env.example .env
# Edit .env: DATABASE_URL + JWT_SECRET
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

From monorepo root only (apply migrations **before** the first seed, or you will see errors such as missing `LeagueSettings`):

```powershell
cd mun-fantasy
npm run db:migrate
npm run db:seed
```

**Do not** run `npx prisma …` from the `mun-fantasy` folder itself: there is no `schema.prisma` there, so `npx` may download Prisma 7 and fail with “Could not find Prisma Schema”. Always use **`npm run db:migrate`** (or `cd backend` and then `npx prisma migrate deploy`).

Notes:

- `npx prisma migrate deploy` (or `npm run db:migrate` from `mun-fantasy`) applies SQL migrations (safe for empty databases). This creates tables such as **`LeagueSettings`**.
- `npm run db:seed` loads **players from JSON** under `backend/seed/teams/*/players.json`, resets fantasy squads / matches / events, creates a **sample upcoming match**, and ensures **league settings**. It does **not** create admin or coordinator users (those come from the API bootstrap — see below).

### Local development (API bootstrap on `npm run dev`)

On startup in **non-production**, the API creates or updates:

- **Admin**: `admin@munfantasy.local` / `Admin12345!` (unless `ADMIN_EMAIL` / `ADMIN_PASSWORD` are set in `.env`)
- **Player**: `player@munfantasy.local` / `Player12345!`
- **Court reps** (unless coordinator env vars are set): `court-a@munfantasy.local` … `court-d@munfantasy.local`, each password **`CourtRep123!`**, courts A–D

You can override any of the above by setting `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `COURT_A_COORD_EMAIL` … `COURT_D_COORD_EMAIL`, and `COORDINATOR_PASSWORD` in `backend/.env` (see `backend/.env.example`).

### Production

1. **Database**  
   Provision PostgreSQL and set `DATABASE_URL`.

2. **API (Node + Socket.IO)** — *not* on Vercel serverless; use any container/VM host (Render, Fly.io, Railway, AWS, etc.):

   - Build/run using `backend/Dockerfile` (runs `prisma migrate deploy` then `node dist/index.js`).
   - Set **`NODE_ENV=production`** on the host.
   - Copy variables from **`backend/.env.production.example`** into the host’s secret manager. All of the following are **required in production**:
     - `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `TRUST_PROXY=1` (when behind a reverse proxy)
     - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
     - `COURT_A_COORD_EMAIL` … `COURT_D_COORD_EMAIL`, `COORDINATOR_PASSWORD`
   - On every deploy/start, the API **upserts** the admin and four coordinators with these credentials (passwords are re-hashed from the env values).

3. **Load players (once per fresh DB or when lists change)**  
   From `mun-fantasy` or `mun-fantasy/backend`:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

4. **Frontend on Vercel**

   - In the Vercel project, set **Root Directory** to `frontend`.
   - Add **`VITE_API_URL`** = your public API origin (must be `https://` if the site is served over HTTPS).
   - `CLIENT_ORIGIN` on the API must include your exact Vercel URL(s), comma-separated if you use both a preview URL and a custom domain.
   - **Fast Origin Transfer:** the browser calls your **API on Render**, not Vercel serverless, so this meter stays **very low** as long as you do **not** add Vercel rewrites/proxies or Edge Middleware that pull from your API. `frontend/vercel.json` sets **long-lived caching** for Vite’s hashed `/assets/*` bundles so repeat visits re-download less.

5. **Live updates without refresh**  
   The client uses **Socket.IO** with a **JWT** on the handshake (`auth.token`). Ensure the browser origin is allowed (`CLIENT_ORIGIN`) and that `VITE_API_URL` points at the same host that serves Socket.IO.

### Scoring rules (implemented in `backend/src/constants/points-rules.ts`)

| Event | Outfield | Goalkeeper |
|------|----------|-------------|
| Goal | +5 | +8 |
| Assist | +3 | +3 |
| Own goal | −2 | −2 |
| Yellow | −1 | −1 |
| Second yellow | −2 | −2 |
| Red | −3 | −3 |
| Penalty miss | −2 | −2 |
| Penalty save | — | +5 |

Additionally: **each GK** on a team loses **1 point per 2 goals conceded** by that team (applied when goals are scored or when the coordinator adjusts the live score). On **match finished**, each GK on a team that **conceded 0** goals gets **+4** (clean sheet), once per match.

Admins can open/close the **transfer market** in the admin dashboard. When it is **off**, players cannot add, remove, or bench/promote squad members (captain changes still work).

## Frontend

```powershell
cd mun-fantasy/frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

## Player JSON seed files

Players are loaded from:

`backend/seed/teams/<team_folder>/players.json`

Each file is a JSON array of objects:

```json
[
  { "name": "Player Name", "team": "Team Name", "isGK": false, "imageUrl": null }
]
```

## Real-time behavior

The coordinator updates a LIVE match → the API persists events + points → Socket.IO emits `match_update`, `goal_added`, and `card_added` → clients joined to `match:<id>` update immediately.

## PlayerCard2

All squad and market visuals should use `frontend/src/components/PlayerCard2.tsx` so styling stays consistent across the app.
