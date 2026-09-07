# ADR 0008: OAuth social login with Google

- **Status:** Accepted
- **Date:** 2026-09-06

## Context

Auth exists so a user can save finished photos to their gallery (ADR 0001). The product asks for
social login with Google alongside the email/password flow, with the username account
model from ADR 0005.

A user may hold an email/password credential plus a linked Google identity.
The backend runs on its own origin from the SPA, so the OAuth redirect must return the
JWT to the browser without a cookie session (ADR 0001 keeps auth stateless).

## Decision

- **OAuth dance runs through the backend.** The SPA links to `GET /api/auth/{provider}/authorize`;
  the browser is redirected to the provider and back to `GET /api/auth/{provider}/callback` on the
  backend. The backend never trusts a client-supplied user id.
- **Separate `oauth_identities` table** (user_id FK, provider, subject) instead of OAuth columns on
  `users`. This reverses the single-table plan sketched in ADR 0005, because one generic
  `oauth_provider`/`oauth_subject` column pair can hold only one identity per user, while the
  linking decision below allows a password account to also hold a Google identity. The
  `(provider, subject)` pair is unique, so a provider account maps to exactly one user even if the
  provider email changes.
- **`users.password_hash` is nullable.** Social-only accounts have no password. Such users cannot
  sign in with a password (the login service treats a NULL hash as a failure).
- **Resolution order on social login:**
  1. Look up `oauth_identities` by `(provider, subject)`; if found, sign that user in.
  2. Else, if the provider's verified email matches an existing `users` row, link a new
     `oauth_identity` to that account and sign it in.
  3. Else, create a new user with an auto-generated username and the identity.
- **Trust the provider's verified email** for the linking lookup. A user who signs in with Google
  on different accounts over time lands on one account when the emails match.
- **No refresh tokens or server sessions.** A successful callback issues the same stateless JWT as
  email/password login (ADR 0001) and redirects the browser to
  `{OAUTH_REDIRECT_BASE}/auth/callback#token=...&user=...`. The token travels in the URL fragment so
  it never appears in server logs or browser history.
- **State nonce as a signed httpOnly cookie.** The authorize route stores a short-lived (10 min)
  HMAC-signed state cookie; the callback requires the provider-returned `state` to match it. The
  cookie is `SameSite=Lax` and deleted after a successful callback.
- **The `next` parameter is validated and carried through state.** Only same-origin absolute paths
  (single `/`, no scheme, no `//`) are accepted; a missing or invalid `next` lands on `/photos`.
- **OAuth failures redirect back to the SPA** (`/login?oauth_error=...`) so the user sees a friendly
  message rather than a raw provider error.
- **Username is the login handle for password accounts** (ADR 0005). The register form collects a
  username; social users get one auto-generated from their provider name (deduplicated with a
  numeric suffix). Renaming is deferred.
- **Save-photo flow never round-trips through `/photobooth/result`.** The booth result is
  in-memory only (ADR 0004) and would be lost on a full-page OAuth redirect. An unauthenticated
  Save shows a confirmation that leaving loses the photo, then sends the user to
  `/login?next=/photos`.
- **Provider wiring is config-driven** (client id/secret + endpoint registry), shared by all
  providers, via `authlib`.

## Consequences

- One account can hold a password plus a Google identity; photos are shared across
  all sign-in methods.
- Linking by verified email is a deliberate trust trade: an attacker who controls a provider
  account whose email matches a victim's account gains access to it. Accepted for the personal-
  gallery threat model; provider email verification is required.
- ADR 0005's single-table OAuth-columns plan and its no-auto-link rule are superseded.
- New providers are a registry entry plus config — no schema change. The registry currently holds
  Google only.
- The state cookie adds a small CSRF defense without a sessions table.

## Open questions

- Whether to allow unlinking an OAuth identity from an account (and what that does to a social-only
  account's ability to sign in).
- Username renaming for both password and social accounts.
