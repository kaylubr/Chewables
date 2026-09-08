# Chewables

A privacy-conscious photobooth web app. Guests can use the full experience — frame selection, webcam capture, Canvas composition, download — with no account. Authentication is only required to permanently save a finished photo.

> **Status:** The full guest flow works end to end: frame selection → webcam capture (5s countdown between shots) → in-browser Canvas composition → download. Signed-in users can save finished photos to a private gallery and delete them. Agent-facing conventions and the stage plan live in [AGENTS.md](AGENTS.md).

## Stack

| Layer    | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Backend  | Node.js, TypeScript, Express 5, Better-Auth, Drizzle ORM           |
| Frontend | SvelteKit (Svelte 5, runes), TypeScript, Vite                     |
| Testing  | Backend: Vitest + Supertest. Frontend: Vitest + jsdom             |
| Database | PostgreSQL 17 (Docker Compose for local dev), Drizzle Kit migrations |
| Storage  | S3-compatible object storage — MinIO in local dev                 |
| Auth     | Better-Auth cookie sessions (email/password + Google OAuth)       |

## Repository layout

```
src/core/   Express backend (npm workspace @chewable/core)
  index.ts         Bootstrap only: start the listener
  app.ts           App wiring only: middleware, routes, error handlers
  config.ts        Centralized env config (single import; no process.env elsewhere)
  db/              Drizzle client + schema (users, photos, sessions, accounts)
  domains/         DDD modules: auth, photos (controller -> service -> repo)
  adapters/storage/ S3-compatible storage seam (MinIO in dev)
  lib/frames.ts    Supported frame identifier vocabulary (backend validation)
  tests/           Vitest + Supertest suite
src/shared/ Shared TS contract types (npm workspace @chewable/shared)
src/ui/     SvelteKit frontend (npm workspace @chewable/ui)
  src/lib/frames/         Frame types + centralized frame registry
  src/lib/photobooth/     Booth session state machine, capture controller, composition
  src/lib/auth/           Session store (cookie-based) + Google sign-in helper
  src/lib/api/            Typed backend API client (shared types)
  src/routes/             Landing, /photobooth/{frame,camera,result}, /login, /register, /photos
  static/frames/          Frame overlay PNGs (test.png is a dev placeholder)
compose.yml PostgreSQL 17 + MinIO services
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ and npm
- [Docker](https://www.docker.com/) (local Postgres + MinIO)

## Local development

### 1. Start the services

```sh
docker compose up -d
```

Runs `postgres:17-alpine` on host port **5434** and MinIO on **9000/9001** (ports chosen to avoid conflicts with other local Postgres instances).

### 2. Install + configure

```sh
npm install
cp .env.example .env        # backend + shared config
cp src/ui/.env.example src/ui/.env   # frontend PUBLIC_API_BASE
```

The backend reads `DATABASE_URL`, `S3_*`, `AUTH_SECRET`, `GOOGLE_*`, and `SESSION_EXPIRES_IN` from `.env` — credentials are never hardcoded (see `src/core/config.ts`).

### 3. Run migrations

```sh
npm run db:migrate
```

### 4. Run the backend

```sh
npm run dev
```

Uses `tsx watch` with `NODE_ENV=development`. The API is served at <http://localhost:8000> with health at `GET /api/health`.

### 5. Run the frontend

```sh
npm run build -w @chewable/ui   # or: cd src/ui && npm run dev
```

In production, `npm run build` builds both workspaces and Express serves the SvelteKit output from the same origin.

## Useful commands

| Command                              | What it does                              |
| ------------------------------------ | ----------------------------------------- |
| `docker compose up -d`               | Start local Postgres + MinIO              |
| `npm run db:migrate`                 | Apply database migrations (drizzle-kit)   |
| `npm run dev`                        | Run the Express backend with tsx watch    |
| `npm test`                           | Run the backend Vitest/Supertest suite     |
| `npm run test:ui`                    | Run the frontend Vitest suite              |
| `npm run check`                      | Type-check all workspaces (tsc --noEmit)   |
| `npm run format`                     | Format + lint the repo (Biome)            |

## Frames

Frames are **not** a database table or a backend concern — they are a fixed, frontend-owned set. Each frame is a static PNG overlay plus a `FrameDefinition` entry:

- Type definitions live in `src/ui/src/lib/frames/types.ts`. `FrameId` is the stable vocabulary (`VINTAGE`, `POLAROID`, `FILM`, `CLASSIC`).
- The registry `src/ui/src/lib/frames/frames.ts` maps each id to its overlay image, photo count, canvas size, and photo-slot rectangles.
- Adding a frame = drop the PNG in `static/frames/` and add one entry to the registry. No per-frame component, no backend/DB change, no migration.
- Capture logic reads only `photoCount`; composition reads the full definition.

**Currently registered:** `FILM` (35mm film strip, 4 photos, 1620×2880 canvas). Only `test.png` exists as a dev placeholder — real artwork comes from the designers.

## Architecture notes

- **Privacy first:** captured webcam frames and the composed result stay client-side. No DB record exists just for opening the photobooth, and guest photos are never uploaded unless the user actively chooses to save. Saved photos travel over TLS in production and live in the user's private object-storage prefix.
- **Client-side booth state:** the frame → capture → result flow lives in module-scoped runes (`store.svelte.ts`) and resets on reload. A guarded state machine (`session.ts`) makes illegal transitions (e.g. duplicate captures) impossible.
- **Auth is only for persistence:** Better-Auth cookie sessions protect the photo endpoints; hashed passwords and Google OAuth are handled by Better-Auth. Logout revokes the session server-side.
- **Data model stays small:** `User` (id, email, password_hash, created_at) and `Photo` (id, user_id, frame, storage_key, created_at). No Frame table; sessions live in Better-Auth's `session` table.
- **Storage:** object storage holds images; Postgres holds only metadata + server-generated `storage_key` (e.g. `users/{user_id}/photos/{photo_id}.webp`). The client never chooses the path, and every photo read/delete verifies ownership first.
- **Server derives identity:** the backend never trusts a client-supplied user ID; the current user always comes from the authenticated session (cookie).
- **Encryption status:** transport security, auth, authorization, and storage security are in place. Photos are **not** client-side encrypted — the server (and an operator with the storage keys) can read saved images. True end-to-end privacy via client-side encryption is a deliberate later stage, not yet implemented.
