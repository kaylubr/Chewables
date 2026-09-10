# ADR 0011: Separate identity, gallery, and settings into distinct pages

- **Status:** Accepted
- **Date:** 2026-09-10

## Context

The profile page had become three pages in one: an identity header (avatar,
username, email), the saved-photo gallery, and the email-verification card. The
photo grid carried its own load and delete logic on top of the session load,
and `/photos` had been reduced to a redirect to `/profile`. This conflated
"who you are" with "what you made" and left the verification nudge buried under
a photo grid.

## Decision

Split the concerns across three routes:

- **`/profile` — identity.** The account header only: avatar, username, and the
  email reveal. No photos, no settings.
- **`/photos` — gallery.** The canonical saved-photo gallery (grid, per-photo
  delete, auth gate). The old `/photos -> /profile` redirect is removed.
- **`/settings` — account settings.** First real content is the email
  verification card; the "Verify email" action lives here, not on the profile.

The authenticated nav gains a top-level **Photos** link (desktop top nav and the
mobile drawer) alongside Photobooth; it is shown only when signed in, since the
gallery is the user's own.

## Consequences

- Each route has one job; the gallery's load/delete logic no longer shares a page
  with identity and verification state.
- A signed-in user reaches their photos from the nav link, not from the profile.
- Email verification is discovered in Settings rather than at the bottom of the
  profile; the profile no longer carries a nudge for it.
- The `/photos` redirect shim is gone, so `/photos` is a real destination again.

## Open questions

- Whether Settings grows beyond email verification (display name, avatar, account
  deletion) or stays a thin account page.
