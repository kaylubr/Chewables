# Onboarding

Detailed, step-by-step setup for a new maintainer. The short version lives in
[README.md](../README.md); this file is the long version — every command, every
environment variable, and every trap we know about.

> Throughout this document, placeholder values are written like
> `<your-google-client-id>`. Never commit real credentials: `.env` files are
> gitignored, and only the `.env.example` templates belong in the repo.

## Contents

- [Prerequisites](#prerequisites)
- [Stack](#stack)
- [Repository layout](#repository-layout)
- [1. Start the local services](#1-start-the-local-services)
- [2. Create the environment files](#2-create-the-environment-files)
- [3. Environment variables](#3-environment-variables)
- [4. Google OAuth setup](#4-google-oauth-setup-required)
- [5. Resend email setup](#5-resend-email-setup-required)
- [6. Create the object-storage bucket](#6-create-the-object-storage-bucket)
- [7. Install and migrate](#7-install-and-migrate)
- [8. Build and run](#8-build-and-run)
- [Setup notes](#setup-notes)
- [QA notes, tips, tricks, traps](#qa-notes-tips-tricks-traps)
- [Gotchas](#gotchas)
- [Future direction](#future-direction)
- [Random notes](#random-notes)

## Prerequisites

| Requirement | Version | Notes |
| ----------- | ------- | ----- |
| Node.js | 22.12+ (developed on 24.x) | Vite 8 requires `^20.19.0 \|\| >=22.12.0`. There is no `.nvmrc`; use a recent LTS. |
| npm | 10+ | The repo is an npm workspaces monorepo. |
| Docker + Compose | current | Runs Postgres and MinIO locally. |
| A Google account | — | To create your own OAuth client (see [Google OAuth setup](#4-google-oauth-setup-required)). |
| A Resend account | — | To send verification email (see [Resend email setup](#5-resend-email-setup-required)). |

You will also need a webcam to exercise the photobooth flow, and a browser with
camera permissions (Chrome or Firefox both work).

## Stack

| Layer | Technology |
| ----- | ---------- |
| Backend | Node.js, TypeScript, Express 4, Better-Auth, Drizzle ORM |
| Frontend | SvelteKit (Svelte 5, runes), TypeScript, Vite |
| Testing | Backend: Vitest + Supertest. Frontend: Vitest + jsdom + Testing Library |
| Database | PostgreSQL 18.6 (Docker Compose), Drizzle Kit migrations |
| Storage | S3-compatible object storage — MinIO in local dev |
| Auth | Better-Auth cookie sessions (email/password + Google OAuth) |
| Email | Resend (verification and email-change messages) |
| Tooling | Biome (format/lint), tsc + svelte-check (types) |

The backend intentionally uses **Express 4**, not 5. The frontend is a separate
npm workspace served by Vite in development.

## Repository layout

```
src/core/   Express backend (npm workspace @chewable/core)
  index.ts         Bootstrap only: start the listener
  app.ts           App wiring only: middleware, routes, global error handler
  config.ts        Centralized env config (the only place process.env is read)
  db/              Drizzle table definitions, one file per table + client
  types/           Backend-only domain types (one file per concept)
  lib/             Shared helpers and the frame vocabulary (frames.ts)
  adapters/storage S3-compatible storage seam (MinIO in dev)
  auth/            Auth domain: routes, controller, service, repo, schema, tests
  photos/          Photos domain: routes, controller, service, repo, schema, tests
  mail/            Resend integration (verification + email-change messages)
  utils/test/      Shared test harness: DB reset, setup, in-memory storage
src/shared/ Shared contract types used by both backend and frontend (@chewable/shared)
src/ui/     SvelteKit frontend (npm workspace @chewable/ui)
  src/lib/frames/         Frame types + centralized frame registry
  src/lib/photobooth/     Booth session state machine, capture, composition
  src/lib/auth/           Session store (cookie-based) + Google sign-in helper
  src/lib/api/            Typed backend API client (shared types)
  src/lib/components/     Shared UI (Modal, ConfirmDialog, Lightbox, …)
  src/routes/             Landing, /photobooth/{frame,camera,result}, /login,
                          /register, /photos, /profile, /settings, /report
  static/frames/          Frame overlay PNGs (classic.png is the registered one)
  vitest.config.ts        Frontend test config (jsdom)
compose.yml PostgreSQL + MinIO services
migrations/ Drizzle SQL migrations
docs/       glossary, ADRs, and this file
```

Backend conventions (domain-oriented modular monolith, wiring-only `app.ts`,
env only through `config.ts`) are documented in [AGENTS.md](../AGENTS.md).

## 1. Start the local services

```sh
docker compose up -d
```

This starts two containers:

| Service | Image | Host port(s) | Credentials |
| ------- | ----- | ------------ | ----------- |
| `db` (Postgres) | `postgres:18.6-alpine3.23` | `5434` → 5432 | user/password/db: `chewables` |
| `minio` | `minio/minio:latest` | `9000` (API), `9001` (console) | `chewables` / `chewables-secret` |

Ports 5434 and 9000/9001 were chosen to avoid clashing with other local
Postgres/MinIO instances. Check state with `docker compose ps` and streams with
`docker compose logs -f`.

## 2. Create the environment files

There is **no root `.env`**. Each workspace owns its own file, and the backend
loads `src/core/.env` explicitly from `src/core/config.ts`:

```sh
cp src/core/.env.example src/core/.env
cp src/ui/.env.example src/ui/.env
```

Both `.env` paths are gitignored; the `.env.example` templates are tracked and
must be kept in sync when variables change.

## 3. Environment variables

### `src/core/.env` (backend)

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `DATABASE_URL` | Yes | — | Postgres connection string for development. Throws at boot if missing. |
| `TEST_DATABASE_URL` | Only when testing | — | Postgres connection string used when `NODE_ENV=testing`. Throws at boot if missing in test runs. |
| `AUTH_SECRET` | Yes | — | Signing secret for Better-Auth sessions. Throws at boot if missing. |
| `SESSION_EXPIRES_IN` | No | `604800` (7 days, seconds) | Session lifetime. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | empty | Google OAuth credentials. Google sign-in fails until both are set. |
| `OAUTH_REDIRECT_BASE` | No | `http://localhost:5173` | SPA origin the OAuth flow returns to. |
| `BACKEND_BASE_URL` | No | `http://localhost:8000` | The backend's public base URL; the Google callback URI is built from it. |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed browser origin in dev (credentials enabled). Ignored in production, where the SPA is same-origin. |
| `S3_ENDPOINT_URL` | No | `http://localhost:9000` | S3-compatible endpoint. |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | No | empty | Storage credentials. |
| `S3_BUCKET` | No | `chewables` | Bucket that must exist (see [step 6](#6-create-the-object-storage-bucket)). |
| `S3_REGION` | No | `us-east-1` | Region for the S3 client. |
| `RESEND_API_KEY` | No | empty | Resend API key. Without it, verification links are logged to the backend console instead of emailed. |
| `MAIL_FROM` | No | `Chewables <verify@chewable.app>` | Sender address; must be a verified sender in Resend. |
| `PORT` | No | `8000` | Backend port. |

### `src/ui/.env` (frontend)

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `PUBLIC_API_BASE` | Yes | — | Base URL of the backend API, e.g. `http://localhost:8000`. |

`src/core/config.ts` is the single source of env truth: `process.env` is not read
anywhere else, and missing required values fail loudly at boot.

## 4. Google OAuth setup (required)

Sign-in with Google needs your own OAuth client. You are not given shared
credentials.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create
   a project (or pick an existing one).
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app
   name, support email, and developer contact. Add the scopes `openid`,
   `.../auth/userinfo.email`, and `.../auth/userinfo.profile`. While the app is in
   testing, add your own Google account under **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Web application**.
4. **Authorized redirect URIs** — add exactly:

   ```text
   http://localhost:8000/api/auth/callback/google
   ```

   This is built from `BACKEND_BASE_URL`, not from the SPA origin. If you change
   `BACKEND_BASE_URL`, you must register the matching URI here.

5. **Authorized JavaScript origins** — add:

   ```text
   http://localhost:5173
   http://localhost:8000
   ```

6. Copy the generated **Client ID** and **Client secret** into
   `src/core/.env`:

   ```sh
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   ```

7. Restart the backend. The login and register pages now show a Google button;
   it runs the round-trip in a popup (falling back to a full-page redirect if the
   popup is blocked).

## 5. Resend email setup (required)

Account creation sends a verification email, and changing your email sends a
confirmation link.

1. Create an account at [resend.com](https://resend.com/).
2. **API Keys → Create API key**, then set it in `src/core/.env`:

   ```sh
   RESEND_API_KEY=re_<your-api-key>
   ```

3. `MAIL_FROM` must be a sender Resend accepts: either verify a domain
   (**Domains → Add domain**, then add the DNS records) and use an address on it,
   or, for local testing, use Resend's onboarding sender:

   ```sh
   MAIL_FROM=onboarding@resend.dev
   ```

4. Email is fire-and-forget: a delivery failure is logged and never fails the
   request that triggered it.

**No key needed to develop.** When `RESEND_API_KEY` is empty (or the app is in
testing, or the address is on a reserved domain such as `example.com` or
`.test`), the mail module logs the message and its link to the backend console
instead of sending. That is often the fastest way to click a verification link
locally — watch the terminal running `npm run dev`.

## 6. Create the object-storage bucket

Saved photos are stored in an S3-compatible bucket named by `S3_BUCKET`
(default `chewables`). The storage adapter can create a bucket, but **nothing
calls that path yet**, so a fresh MinIO volume has no bucket and saving a photo
fails until you make one:

1. Open the MinIO console at <http://localhost:9001>.
2. Log in with `chewables` / `chewables-secret`.
3. **Buckets → Create Bucket**, name it `chewables` (it must match `S3_BUCKET`).

Docker volumes persist across restarts, so this is a one-time step per volume.
Recreate it if you ever run `docker compose down -v`.

## 7. Install and migrate

```sh
npm install
npm run db:migrate
```

`db:migrate` reads `drizzle.config.ts`, which imports the backend config and
therefore `src/core/.env` — so Postgres must be running and `DATABASE_URL` must
be set first.

## 8. Build and run

Local development uses two terminals. There is no working single-command
production build (see [Gotchas](#gotchas)).

**Terminal 1 — backend** (Express, port 8000):

```sh
npm run dev
```

Runs `tsx watch src/core/index.ts` with `NODE_ENV=development`. The API is served
at <http://localhost:8000>. Routes are mounted under `/api/auth` and
`/api/photos`; unknown `/api/*` paths return a JSON 404.

**Terminal 2 — frontend** (Vite dev server, port 5173):

```sh
cd src/ui
npm run dev
```

Open <http://localhost:5173>. The frontend calls the backend using
`PUBLIC_API_BASE`, so both servers must be running for sign-in, saving, and the
gallery to work. The root `npm run dev` starts the backend only.

Useful pages: `/` (landing, FAQ, about), `/photobooth/frame` → `/photobooth/camera`
→ `/photobooth/result` (guest flow), `/login`, `/register`, `/profile`,
`/photos` (gallery), `/settings`, `/report` (stub).

Stop both with Ctrl-C when you are done, and `docker compose down` if you want to
stop the containers.

## Setup notes

- **Config resolution.** `src/core/config.ts` loads `src/core/.env` explicitly via
  dotenv. Required variables (`DATABASE_URL`, `AUTH_SECRET`) throw at boot.
  `NODE_ENV=testing` switches `databaseUrl` to `TEST_DATABASE_URL`; the value is
  set by `cross-env` in the npm scripts.
- **Env files per workspace.** There is no root `.env`; put backend values in
  `src/core/.env` and the frontend value in `src/ui/.env`.
- **Ports.** Backend 8000, frontend 5173, Postgres 5434, MinIO 9000/9001. The
  non-default Postgres port is deliberate.
- **Docker volumes.** `db-data` and `minio-data` persist between restarts;
  `docker compose down -v` wipes both (databases *and* bucket).
- **CORS.** In development the backend allows `CORS_ORIGIN` with credentials, so
  the SPA on 5173 can talk to the API on 8000. In production CORS is disabled
  because Express would serve the SPA from the same origin.
- **Sessions.** Better-Auth stores sessions in the `session` table and issues an
  httpOnly cookie (`chewables.session`); no token is kept in browser storage.
- **Mail fallback.** With no `RESEND_API_KEY`, verification links are printed to
  the backend console — perfectly usable for local development.
- **Node version.** Vite 8 requires Node `^20.19.0 || >=22.12.0`. There is no
  `.nvmrc`; installation is not pinned to a specific minor.

## QA notes, tips, tricks, traps

### Automated tests

Backend (Vitest + Supertest):

```sh
npm test          # single run
npm run test:watch
```

- Runs with `NODE_ENV=testing`, so it uses `TEST_DATABASE_URL` — currently
  `chewables_test`.
- The test database name says "test". **Create that database before the first
  run** (it is not created automatically):

  ```sh
  docker compose exec db createdb -U chewables chewables_test
  ```

- Global setup **drops and recreates the `public` schema** in the test database,
  and a `beforeEach` truncates the tables between tests. Never point
  `TEST_DATABASE_URL` at your development database.
- Tests run serially (`fileParallelism: false`) because they share one database.
- The photos tests use an in-memory storage adapter, so **MinIO is not needed for
  `npm test`** — only Postgres is.
- Current suite: 6 files, 76 tests.

Frontend (Vitest + jsdom + Testing Library):

```sh
npm run test:ui
cd src/ui && npm run test:watch
```

Current suite: 15 files, 111 tests.

### Types and formatting

```sh
# Backend
npx tsc -p src/core/tsconfig.json --noEmit

# Frontend
npm run check -w @chewable/ui

# Format / lint (Biome)
npm run format:check   # read-only
npm run format         # writes fixes
```

Coverage is expected, at minimum, for: auth behavior, password hashing, frame
validation, photo ownership, photo create/delete, and invalid uploads.

Tips and traps:

- The root `npm run check` script is currently broken (see
  [Gotchas](#gotchas)) — use the two commands above.
- `npm run format:check` currently reports a large backlog because no Biome
  config file is checked in. `npm run format` will rewrite many files; don't run
  it casually in the middle of unrelated work.
- Tests assert on real HTTP behavior for the backend and on component behavior
  for the frontend; both suites are the fastest way to catch regressions before
  manual browser checks.

## Gotchas

### Local infrastructure

- **`npm test` needs `chewables_test` to already exist**; migrations do not
  create it. Create it once with `docker compose exec db createdb -U chewables chewables_test`.
- **The MinIO bucket is not created by the app.** Create `chewables` in the
  MinIO console, or saving a photo fails.
- **`docker compose down -v` wipes both the databases and the bucket.**
- **A stray `src/ui/.npmrc` (`engine-strict=true`) can make npm reject an
  unsupported Node version** with a workspace-config warning. Use Node 22.12+.
- **Ports 5434/9000/9001 are non-default** so they don't collide with other local
  services; check `docker compose ps` before assuming something is broken.

### Frames and canvas

- **Frame overlays must be PNGs with real alpha transparency** (the photo windows
  must be transparent). An opaque format like JPEG bakes in a checkerboard and the
  composed image shows only the frame.
- **`photoSlots` must match the artwork.** Coordinates are canvas pixels and are
  not inferred from the image; measure them against the PNG.
- **Draw order is photos first, then the overlay** — the result is a single
  composited bitmap, so z-index and DOM layering cannot help.
- **The result is WebP.** Composition runs entirely in the browser; nothing is
  uploaded until the user chooses to save.
- Only `FILM` is registered today (`/frames/classic.png`, 564×1365, 4 photos).
  `FRAME_IDS` in `@chewable/shared` also lists `VINTAGE`, `POLAROID`, and
  `CLASSIC`, but no definitions or artwork exist for them yet — the frontend
  filter and backend validation both derive from that shared id set.

### Auth and OAuth

- **The Google redirect URI is the backend's, not the SPA's:**
  `${BACKEND_BASE_URL}/api/auth/callback/google`. Registering the callback on the
  SPA origin produces a redirect_uri_mismatch.
- **Google sign-in runs in a popup** (with a full-page redirect fallback when the
  popup is blocked). `static/auth-popup.html` is the popup's landing page.
- **`CORS_ORIGIN` must match the frontend origin** (default `http://localhost:5173`)
  or credentialed requests fail.
- **Changing an email sends a confirmation link**, and the flow revokes other
  sessions after verification. In local dev, watch the backend console for the
  link if Resend isn't configured.
- **`requireEmailVerification` is false**, so you can sign in before verifying
  your email.

### Storage and production

- **The production build path is not wired up.** The root `npm start` expects
  `dist/core/index.js`, but the backend builds to `src/core/dist/`; the UI uses
  `@sveltejs/adapter-auto` (which detects no production environment and outputs
  to `.svelte-kit/output`), while `app.ts` looks for `../ui/build` when serving
  statically. Do not rely on `npm run build && npm start` to serve the app yet.
- **Storage keys are server-generated** (`users/{userId}/photos/{photoId}.webp`);
  the client never chooses a path.
- **Save/delete ordering is deliberate.** On create: object first, then row
  (a failed insert cleans up the object). On delete: row first, then object
  (an orphaned file is preferable to a row pointing at a missing object).
- **Uploads are capped at 20 MB** and restricted to `image/jpeg`, `image/png`,
  and `image/webp`.
- **Deleted account data cascades**, and stored objects are removed using the keys
  captured before the user row disappears.

## Future direction

Assembled from the ADRs, the glossary, and the current state of the code. None of
this is committed to a date.

- **Real frame artwork.** Only `FILM` exists, using `classic.png`. The remaining
  vocabulary ids (`VINTAGE`, `POLAROID`, `CLASSIC`) are placeholders; adding a
  frame is a PNG plus one registry entry — no backend, database, or migration
  change.
- **Frame variety in the UI.** The frame picker currently offers a single option.
- **Email verification as a requirement.** It is implemented and sent, but
  sign-in does not require it yet.
- **Production deployment.** No Dockerfile, no CI, and no production adapter;
  `app.ts` already has the same-origin static-serving path for when one exists.
- **A health endpoint.** The API has no health route today; unknown `/api/*`
  requests return a JSON 404.
- **Client-side encryption.** Transport, auth, authorization, and storage security
  are in place, but saved photos are not end-to-end encrypted — the server (and
  an operator with storage keys) can read them. True end-to-end privacy via
  client-side encryption is a deliberate later stage, not yet implemented.
- **Biome configuration.** No `biome.json` is checked in, so formatting rules
  come from Biome's defaults and `format:check` reports a backlog.
- **A root type-check script.** A root `tsconfig.json` and a `check` script that
  actually runs across workspaces.

## Random notes

- **Guest privacy is a product invariant.** Captured frames and the composed
  result stay in the browser. Never create a database record just because someone
  opened the photobooth, and never upload a guest photo unless they choose to
  save it.
- **Frames are not a database table.** They are a fixed, frontend-owned id set
  shared with the backend purely for validation.
- **The server always derives identity from the session** and never trusts a
  client-supplied user id.
- **Domain boundaries matter.** Each domain (`auth`, `photos`) owns its routes,
  controllers, services, repos, schemas, and tests; domains talk through public
  services, never each other's internals.
- **The report page is a stub** (`/report`) that currently points at the contact
  email and the GitHub issues page.
- **The app links to `github.com/kaylubr/chewables` in the UI, while the git
  remote is `github.com/kaylubr/chewable`.** Worth reconciling at some point.
- **License:** MIT — see [LICENSE](../LICENSE).
- **Agent-facing conventions** live in [AGENTS.md](../AGENTS.md); architecture
  decisions are recorded in [docs/adr/](adr/); shared vocabulary is in
  [docs/glossary.md](glossary.md).
