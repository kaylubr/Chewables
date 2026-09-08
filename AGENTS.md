# Memory

## Project Overview

A privacy-conscious photobooth web app. Guests use the full experience (frame selection, webcam capture, Canvas composition, download) with no account; authentication is only required to permanently save a finished photo. See [README.md](README.md) for the stack, repo layout, setup, and current status.

## Code Style Guidelines

- One purpose per file, no giant utility or catch-all modules.
- `app.ts` is wiring only (app creation, middleware, route mounting, error handlers) — never endpoint logic.
- Routes stay thin: validate input → authenticate/authorize → call a service → return response. No DB or storage internals in route handlers.
- Business logic lives in the domain layer (`domains/*/*.service.ts`), not in routes or DB schema.
- Layering within a domain mirrors DDD: `*.controller.ts` (HTTP) → `*.service.ts` (business logic) → `*.repo.ts` (data access). See `src/core/domains/`.
- Centralize env config in `src/core/config.ts`; never call `process.env.*` outside it. Required vars throw at boot.
- Frontend frame logic lives in one centralized `FrameDefinition` config — capture logic only needs `photoCount`; composition reads the full definition.
- Shared wire types between backend and frontend live in `src/shared` and are imported from `@chewable/shared` on both sides.
- Never trust a client-supplied user ID — the server always derives the current user from the session.
- Git commits are atomic: one logical change per commit. No "update backend" / "fix stuff".
- Commit messages are plain: no `Co-authored-by` or other attribution trailers appended by the assistant, normal commits only.

## Architecture Notes

- **Frames are not a DB table.** Fixed enum/identifier set (VINTAGE, POLAROID, FILM, CLASSIC), owned by the frontend.
- **Data model stays small:** `User` (id, email, password_hash, created_at) and `Photo` (id, user_id, frame, storage_key, created_at). One-to-many User→Photo. Sessions are managed by Better-Auth in its own `session` table.
- **Auth is Better-Auth cookie sessions** (ADR 0010 supersedes ADR 0001/0008): email/password + Google OAuth handled by Better-Auth; no bearer token stored in the browser.
- **No persistent Session model of our own** unless a real need shows up. Guest photobooth state lives entirely in frontend state.
- **Guest privacy:** captured images and the composed result stay client-side. Never create a DB record just because someone opened the photobooth. Never upload guest photos unless the user actively chooses to save.
- **Storage:** object storage holds images; Postgres holds only metadata + `storage_key`. Backend generates storage keys (e.g. `users/{user_id}/photos/{photo_id}.webp`) — never let the client choose the path. Save/delete ordering follows ADR 0006 (object first, then row on create; row first, then object on delete).
- **Encryption:** normal secure transport/auth/storage for now. Client-side encryption (server never holds the key) is Stage 19, after the core app is stable — don't build or claim it early.

## Common Workflows

- Start local services: `docker compose up -d`
- Backend reads `DATABASE_URL` from `.env` (via `src/core/config.ts`), never hardcode credentials; keep `.env.example` in sync.
- Install/rebuild: `npm install`, `npm run build`
- Develop: `npm run dev` (tsx watch, `NODE_ENV=development`)
- Migrate: `npm run db:migrate` (drizzle-kit)
- Test: `npm test` (Vitest + Supertest, `NODE_ENV=testing`, against the `chewables_test` database)
- Format/lint: `npm run format` (Biome)
- Minimum test coverage: auth behavior, password hashing, frame validation, photo ownership, photo create/delete, invalid uploads.
- After finishing a stage: run relevant tests, verify nothing existing broke, then commit.
- See the `photobooth-plan` skill for the full staged build order and commit sequence.
