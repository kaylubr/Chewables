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
- **Session (Better-Auth)** — The auth credential issued at login: a signed, httpOnly cookie that Better-Auth stores in the `session` table (replaces ADR 0001's stateless JWT; see ADR 0010). The server reads it each request; no bearer token is stored in the browser.
- **OAuth provider** — Google; the identity provider a user signs in through (ADR 0008, superseded by ADR 0010 for mechanism). Providers are config-driven in a registry.
- **Provider subject** — The provider's stable identifier for an account (Google `sub`). Unique per provider.
- **OAuth identity** — One row in `oauth_identities` linking a user to a provider account (provider + subject). A user may hold several, at most one per provider (ADR 0008).
- **Account linking** — Attaching a new OAuth identity to an existing user whose verified email matches the provider profile (ADR 0008). With Better-Auth, the Google plugin does the email-match linking; a social login with no email match creates a new user. This resolution order is preserved and tested.
- **State nonce** — The signed state parameter Better-Auth issues and validates during the OAuth callback; the anti-CSRF check of the flow (ADR 0008, mechanism now handled by Better-Auth's Google plugin).
- **Save** — The authenticated action that uploads a finished composition to the backend and records a `Photo` row. A guest who presses Save is warned that leaving the booth loses the in-memory result, then routed to login with `next=/photos`.

## Persistence / storage

- **Photo** — A saved-photo metadata row: id, user_id (FK), frame id string, storage_key, created_at. One-to-many User → Photo.
- **Storage key** — The backend-generated object-store path, e.g. `users/{user_id}/photos/{photo_id}.webp`. The client never chooses it.
- **Object storage** — S3-compatible storage holding the image bytes (ADR 0002); MinIO in dev, a real S3-compatible provider in prod.

## Surfaces

- **Profile** — The identity page (`/profile`): avatar, username, email reveal. Does not show photos (ADR 0011).
- **Gallery** — The saved-photo page (`/photos`): the user's own saved compositions with delete. The canonical photo surface; reached from the authenticated nav (ADR 0011).
- **Settings** — The account page (`/settings`): currently the email-verification card. A thin account surface, not a photo surface (ADR 0011).
