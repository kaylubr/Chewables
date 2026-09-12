# Chewables

A photobooth web app. Pick a frame, take a few photos with your webcam, and get a
finished photo you can download — or save it to your account and come back to it
later.

> **Status:** Under active development. The guest photobooth flow and the
> account, gallery, and settings features work; some surfaces are still being
> built out. See [Gotchas, future direction, and other notes](#gotchas-future-direction-and-other-notes).

## What is this? What does it do?

Chewables is a photobooth that runs in the browser. Anyone can use it without an
account:

- **Pick a frame**, then take the number of photos that frame needs — the camera
  counts you down before each shot.
- The shots are **composed into the frame in your browser** and offered as a WebP
  download. Nothing is uploaded while you use the booth.
- **Create an account** to save finished photos to a private gallery, view them
  full size, and delete them. Sign-in is email/password or Google.
- Account pages cover a profile, the photo gallery, and settings (email
  verification, changing email or password, deleting your account).

Under the hood it is a Node/Express backend and a SvelteKit frontend in one npm
workspaces monorepo, with Postgres for metadata and S3-compatible object storage
for images. The full stack table and repository layout live in
[docs/onboarding.md](docs/onboarding.md).

## Who is responsible for maintaining it?

Chewables is a solo-maintained project with no formal support or response
commitment. For security reports, follow [SECURITY.md](SECURITY.md) rather than
opening a public issue.

## How do I set up my environment?

Prerequisites: Node.js 22.12+ and Docker. The short version:

```sh
docker compose up -d
cp src/core/.env.example src/core/.env
cp src/ui/.env.example src/ui/.env 
npm install
npm run db:migrate
```

Two things these commands deliberately leave to you: create the MinIO bucket
(`chewables`, via the console at <http://localhost:9001>), and create the
`chewables_test` database before running the tests. Both are covered, along with
every environment variable and the required Google and Resend setup, in
[docs/onboarding.md](docs/onboarding.md).

## How do I build and run this?

Local development uses two terminals:

```sh
npm run dev
cd src/ui && npm run dev
```

Open <http://localhost:5173>. The frontend reaches the backend through
`PUBLIC_API_BASE`, so both servers must be running for sign-in, saving, and the
gallery. There is currently no working single-command production build — see the
gotchas below.

Step-by-step detail is in
[docs/onboarding.md](docs/onboarding.md#8-build-and-run).

## Setup notes

- Environment files live per workspace — `src/core/.env` and `src/ui/.env`. There
  is no root `.env`.
- The local services use non-default ports on purpose: Postgres `5434`, MinIO
  `9000` (API) and `9001` (console).
- Required backend variables fail loudly at boot if missing: `DATABASE_URL` and
  `AUTH_SECRET`. Everything else has a default.
- With no `RESEND_API_KEY`, verification emails are printed to the backend console
  instead of sent.
- Docker volumes persist across restarts; `docker compose down -v` wipes the
  databases and the storage bucket.

Full detail in [docs/onboarding.md](docs/onboarding.md#setup-notes).

## QA notes, tips, tricks, traps

```sh
npm test
npm run test:ui
npm run format:check
```

- Backend tests hit a real Postgres test database and reset it between tests; the
  frontend tests run in jsdom.
- Types: `npx tsc -p src/core/tsconfig.json --noEmit` for the backend and
  `npm run check -w @chewable/ui` for the frontend. The root `npm run check` is
  currently broken.
- Two easy traps: `chewables_test` must exist before `npm test`, and MinIO is not
  needed for the test suite (it uses an in-memory storage adapter).

The coverage expectations and the rest of the tips live in
[docs/onboarding.md](docs/onboarding.md#qa-notes-tips-tricks-traps).

## Gotchas, future direction, and other notes

A few things worth knowing before touching the code:

- **The production build is not wired up.** The root `npm start` and the static
  path in `app.ts` do not line up with where each workspace actually builds.
- **Only one frame exists** (`FILM`, using `static/frames/classic.png`). The frame
  vocabulary lists four ids, but the rest are placeholders.
- **Frame overlay PNGs need real alpha transparency**, and `photoSlots` must be
  measured against the artwork — the composed image draws photos first and the
  overlay on top.
- **The Google redirect URI is the backend's**:
  `http://localhost:8000/api/auth/callback/google`.
- **Guest privacy is an invariant**: nothing is uploaded unless the user chooses
  to save.

Planned work includes real frame artwork, more frames, a production deployment
path, a health endpoint, and client-side encryption as a deliberate later stage.
The full list is in [docs/onboarding.md](docs/onboarding.md#future-direction).

**More docs:** [docs/onboarding.md](docs/onboarding.md) ·
[docs/adr/](docs/adr/) · [docs/glossary.md](docs/glossary.md) ·
[AGENTS.md](AGENTS.md) (conventions for AI agents) · [LICENSE](LICENSE)
