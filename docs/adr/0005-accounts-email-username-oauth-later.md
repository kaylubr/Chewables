# ADR 0005: Accounts with email + username, OAuth as a later stage

- **Status:** Accepted
- **Date:** 2026-09-05

## Context

Registration was originally scoped as email + password. The product now asks for: email, a **unique username**, password, and confirm-password on the registration form, plus optional **Google and Facebook** social login. The User model must stay small, and auth exists only so a user can save photos.

## Decision

- **Username is the login identifier** on the sign-in form; email is collected and unique but is not the primary login handle.
- Registration fields: email, username, password, confirm-password (schema-validated; confirm-password is a client + schema check, not a stored field). Password is hashed with an established algorithm (argon2 via pwdlib — already a dependency) — never plaintext.
- **One `User` table** with optional OAuth columns (e.g. `oauth_provider`, `oauth_subject`) rather than a separate linking table. *Superseded by ADR 0008:* OAuth identities live in a separate `oauth_identities` table so one account can link multiple providers.
- **No automatic identity linking.** If a social login's verified email matches an existing password account, the user logs in with the password; the accounts are not silently merged. *Superseded by ADR 0008:* a social login whose verified email matches an existing account links a new identity to that account.
- **Google and Facebook login ship as a separate later stage**, after core email/password auth is stable. The schema may carry the OAuth columns from the start, but the flows are not built early. *Facebook was dropped before shipping; social login is Google-only (see ADR 0008).*
- Multiple simultaneous sessions per user are allowed (see ADR 0001).

## Consequences

- The User model grows slightly (username, optional OAuth columns) but stays small and single-table.
- Social login needs OAuth client id/secret in `.env.example` when that stage lands.
- No auto-link means a user could in principle hold two accounts (one password, one social) with the same email — accepted to avoid silent-merge security holes.

## Open questions

- Username rules (allowed characters, min/max length, case sensitivity) and exact OAuth column shape — settle when registration or the social stage lands.
