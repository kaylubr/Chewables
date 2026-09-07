# Chewables Glossary

Shared vocabulary for the Chewables photobooth. Terms here mean exactly what this file says; prefer them over loose synonyms in code, docs, and review.

## Booth / capture

- **Booth session** — The ephemeral, client-side state of one photobooth run: current state, selected frame, captured stills, countdown. Lives in module-scoped runes and resets on reload (ADR 0004). Not a database record.
- **Frame** — A static visual overlay plus a `FrameDefinition` describing how captured photos sit under it. Not a database entity and not rendered by the backend. A frame is artwork + one registry entry in `src/lib/frames/frames.ts`.
- **FrameDefinition** — The configuration object for one frame: `id`, `name`, `image`, `photoCount`, `width`, `height`, `photoSlots`. Capture logic reads only `photoCount`; composition reads the full definition.
- **PhotoSlot** — One rectangle on the frame canvas where a captured photo is drawn: `x`, `y`, `width`, `height`, `rotation`. Explicit configuration data measured against the frame's canvas; never inferred from the image.
- **PhotoCapture** — One webcam still taken during a booth session, held in browser memory as a data URL with its capture index.
- **Composition** — The client-side Canvas step that draws captured photos into the frame's photo slots and paints the frame overlay on top, producing the final WebP image.
- **Countdown** — A 5-second pre-shot delay before each individual capture (ADR 0003). One countdown per shot, not one per burst.
- **Guest** — A user running the booth with no account. Guests can capture, compose, and download; their photos never leave the browser.

## Identity / auth

- **User** — The database account: id, unique username, email, password hash (nullable for social-only accounts), created_at. A user holds an email/password credential and/or linked OAuth identities (ADR 0005, ADR 0008).
- **Stateless signed token** — The auth credential issued at login (ADR 0001): self-validating, carries the user id and expiry, no session table, short-lived, no refresh token in the initial version.
- **OAuth provider** — Google; the identity provider a user signs in through (ADR 0008). Providers are config-driven in a registry.
- **Provider subject** — The provider's stable identifier for an account (Google `sub`). Unique per provider.
- **OAuth identity** — One row in `oauth_identities` linking a user to a provider account (provider + subject). A user may hold several, at most one per provider (ADR 0008).
- **Account linking** — Attaching a new OAuth identity to an existing user whose verified email matches the provider profile (ADR 0008). Without an email match, a social login creates a new user.
- **State nonce** — The signed httpOnly cookie set at OAuth authorize and required back at the callback; the anti-CSRF check of the OAuth flow (ADR 0008).
- **Save** — The authenticated action that uploads a finished composition to the backend and records a `Photo` row. A guest who presses Save is warned that leaving the booth loses the in-memory result, then routed to login with `next=/photos`.

## Persistence / storage

- **Photo** — A saved-photo metadata row: id, user_id (FK), frame id string, storage_key, created_at. One-to-many User → Photo.
- **Storage key** — The backend-generated object-store path, e.g. `users/{user_id}/photos/{photo_id}.webp`. The client never chooses it.
- **Object storage** — S3-compatible storage holding the image bytes (ADR 0002); MinIO in dev, a real S3-compatible provider in prod.
