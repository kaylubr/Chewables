# ADR 0001: Stateless signed-token authentication

- **Status:** Superseded by ADR 0010 (Node/Express + Better-Auth cookie sessions)
- **Date:** 2026-09-05

## Context

Authentication exists only so a user can permanently save a finished photobooth photo. Guests use the full booth (frame selection, capture, composition, download) with no account, so the backend's auth surface is small: register, login, logout, current-user, and protecting photo persistence endpoints.

The project rules rule out a persistent Session table unless a real need appears. The frontend (SvelteKit) and backend (FastAPI) run as separate origins, so cookie-based sessions would add CSRF and same-site handling that buys little here.

## Decision

Use a **stateless signed token** as the auth mechanism:

- On successful login, the backend issues a signed token carrying the user id and an expiry.
- The token is self-validating — no database lookup or session row on each request.
- The backend derives the current user from the token; it never trusts a client-supplied user id.
- Tokens are **short-lived only** (configurable via `AUTH_TOKEN_EXPIRE_MINUTES`; the `.env.example` default is 10080 minutes = 7 days). No refresh tokens in the initial version — when a token expires, the user logs in again.
- Multiple simultaneous sessions per user are allowed (stateless tokens make this natural). Logout only discards the client's copy of the token.

## Consequences

- No Session table, no session-revocation list, no per-request DB hit for auth.
- A leaked token is usable until it expires; short expiry bounds the window.
- Logout cannot invalidate a token server-side — acceptable because the only protected resource is the user's own photo gallery.
- Token signing secret (`AUTH_SECRET`) is configuration, loaded from `.env`, never hardcoded.

## Open questions

- Exact signing library (e.g. PyJWT vs python-jose) and whether to use an opaque signed token vs a JWT — to be settled when the auth stage lands.
