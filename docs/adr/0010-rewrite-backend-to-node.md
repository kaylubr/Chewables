# ADR 0010: Rewrite the backend to Node.js (Express + Better-Auth + Drizzle)

- **Status:** Accepted
- **Date:** 2026-09-08

## Context

The backend was built on Python 3.14 / FastAPI with SQLAlchemy, Pydantic, Alembic, and a custom OAuth dance (ADR 0001, ADR 0008). The maintainer prefers working in JavaScript/TypeScript and wants a single language across the stack with shared types for the SvelteKit frontend. FastAPI's structure is not the fit they want for this project.

The rewrite must keep the current product behavior and data model while replacing the implementation stack and consolidating documentation, packaging, and tooling around Node.

## Decision

Replace the Python backend with a Node.js/TypeScript backend:

- **Stack:** Express 5 (app wiring in `app.ts`, listener bootstrap in `index.ts`), TypeScript, Better-Auth (email/password + Google plugin) for auth, Drizzle ORM + Drizzle Kit for persistence/migrations, Vitest + Supertest for tests, Biome for formatting/linting, `tsx` for dev watching, and `cross-env` for `NODE_ENV` (`production` | `development` | `testing`).
- **Monorepo:** root `package.json` npm workspaces across `src/core` (Express backend), `src/ui` (SvelteKit frontend), and `src/shared` (shared contract types). The shared types package makes the backend/frontend contract explicit and single-sourced.
- **Centralized config:** all environment access lives in `src/core/config.ts`; no `process.env` reads elsewhere. Required vars throw at boot.
- **Auth sessions:** Better-Auth cookie sessions supersede ADR 0001's stateless JWT and ADR 0008's custom OAuth state-cookie + fragment-redirect dance. The Google plugin manages the OAuth state and callback itself; account resolution order from ADR 0008 (identity → verified-email match → new user) is preserved and tested.
- **Serving:** in production Express serves the built SvelteKit app from the same origin; in development the Vite dev server talks to the API cross-origin with `credentials: 'include'`. Cookie security flags and CORS origins are driven by `NODE_ENV`.
- **Object storage:** the S3-compatible storage seam (MinIO in dev) and the save/delete ordering rules from ADR 0006 are retained unchanged.

## Supersedes

- Supersedes ADR 0001 (stateless signed token) — replaced by cookie-based Better-Auth sessions.
- Supersedes ADR 0008 (custom OAuth social login dance) — replaced by Better-Auth's Google plugin.

## Consequences

- Single language across the stack and one package manager / build chain.
- The frontend no longer stores a token in localStorage; it reads the session cookie and `GET /api/auth/me`.
- All Python artifacts (`pyproject.toml`, `uv.lock`, `alembic/`, `alembic.ini`, `.venv/`, `src/core/*.py`, `tests/*.py`, `.python-version`, `.pytest_cache`) are removed.
- Next runs on Node; tests run on Vitest + Supertest against the same Postgres test database used before.

## Open questions

- None.