# Racket Score

A badminton club-night app for organizing pickup tournaments with _balanced
random matchmaking_, built around a persistent player pool shared across
tournaments.

## Screenshots

|                        Active                         |                        Create Tournament                         |
| :---------------------------------------------------: | :--------------------------------------------------------------: |
| <img src="docs/screenshots/active.png" width="220" /> | <img src="docs/screenshots/create-tournament.png" width="220" /> |

|                        Overall Scoreboard                         |                        Member                         |
| :---------------------------------------------------------------: | :---------------------------------------------------: |
| <img src="docs/screenshots/overall-scoreboard.png" width="220" /> | <img src="docs/screenshots/member.png" width="220" /> |

## Features

- Central, persistent player pool with generated placeholder avatars
  (initials + name-derived color)
- Self-selected skill level until 3 matches are played, then an
  automatically computed win-rate-derived effective level
- Balanced random matchmaking (not round-robin) — see [Matchmaking
  algorithm](#matchmaking-algorithm) below
- Singles **or** doubles per tournament, with configurable games-per-match
  and points-per-game
- Deuce cap auto-computed from the BWF 21→30 ratio:
  `round(pointsPerGame * 30 / 21)`
- Two win-rate-based scoreboards: per-tournament and an overall
  cross-tournament view with period/match-type filters
- 5-tab bottom navigation: Create / Active / Scoreboard / History / Member
- Manual override for a drawn-but-not-yet-started match — swap a player
  before the match starts, with a non-blocking warning if the edit breaks
  doubles' gender-balance rule; edited matches are flagged in History
- Cancel a tournament before its first match result is confirmed —
  replaces the End action during that window, permanent, shown as a
  "Cancelled" row in History
- Thai/English language toggle, light/dark theme support

## Design decisions & intentional limitations

These are deliberate design choices, not missing features:

- **No authentication.** Anyone with the link can create or edit data — this
  is meant for private, trusted club use.
- **Confirmed match results are permanently locked.** There is no edit UI
  and no admin override anywhere in the app. A drawn-but-not-yet-started
  match is different — the organizer can edit its lineup before it starts;
  it's the _result_, once confirmed, that can never be changed.
- **Participants are chosen once, at tournament creation, from the player
  pool.** There is no way to add a player to an in-progress tournament.
- **Cancelling a tournament is permanent.** It's only available before the
  tournament's first match result is confirmed, and there's no path back
  to active once cancelled.
- **No fixed round count.** The UI always shows "Round N", never "Round N of
  M" — a tournament runs until the organizer manually ends it.
- **No real-time sync.** Data updates via polling/manual refresh only.
- **No photo upload.** Player avatars are always a generated placeholder.
- **Doubles pairs are never persisted as an entity.** Every tournament
  re-pairs individuals from the pool.

## Matchmaking algorithm

The matchmaking engine (`src/features/matchmaking/`) is pure TypeScript with
no React or Supabase dependency, so it can be unit-tested in isolation. It
picks the next match by applying these criteria in strict priority order
(highest first):

1. **Equal match count** — a hard invariant, not just a preference: the gap
   between the most- and least-played participant can never exceed 1. If the
   lowest-match-count group is smaller than the match needs, every player in
   it is drawn, and only the remaining seats are filled from the next group.
2. Skill balance
3. Gender balance
4. Avoid repeat pairings from earlier matches
5. Random choice among whatever remains tied after 1–4

**Doubles is a special case:** gender balance is promoted to a hard filter
above skill balance — a 2-male/2-female quartet split into two mixed-gender
teams is always preferred over an unbalanced alternative, not just used to
break a tie. Singles is unaffected.

While a match is in progress, its participants are excluded from the next
draw's candidate pool (falling back to reusing one, with a UI warning, only
if too few other players remain).

Random tie-breaking in step 5 never overrides a higher-priority criterion —
it only chooses among players/pairings that are already equivalent on every
criterion above it.

## Tech stack

- [Vite](https://vitejs.dev/) 6 + [React](https://react.dev/) 18 +
  TypeScript 5
- [react-router-dom](https://reactrouter.com/) 7 for the 5-tab navigation
- [TanStack Query](https://tanstack.com/query) 5 on top of the
  [Supabase](https://supabase.com/) JS client 2
- [react-i18next](https://react.i18next.com/) for the Thai/English toggle
- [Vitest](https://vitest.dev/) 4 + React Testing Library for tests
- Plain CSS (no Tailwind) with custom properties for light/dark theming
- Deployed on [Vercel](https://vercel.com/) via the GitHub integration

> **Node version note:** dependency majors here are pinned below latest —
> `vite@^6` (not 7+), `jsdom@^26` (not 27+), `react@^18` (not 19) — because
> local development targets Node 20.13.1, which is below what those newer
> majors require. Check this constraint before upgrading any of these
> packages.

## Getting started

**Prerequisites:** Node.js ≥ 20.13.1, npm, and a Supabase project (see
[Database setup](#database-setup)).

```bash
git clone https://github.com/narupong-jm/racket_score.git
cd racket_score
npm install
cp .env.example .env   # then fill in your Supabase values, see below
npm run dev
```

The dev server prints a local URL (default `http://localhost:5173`).

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable                 | Description                     | Where to find it                            |
| ------------------------ | ------------------------------- | ------------------------------------------- |
| `VITE_SUPABASE_URL`      | Your Supabase project's API URL | Supabase dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Public anon/publishable API key | Supabase dashboard → Project Settings → API |

Never commit `.env` — it's gitignored. `.env.example` contains placeholders
only.

## Database setup

The app uses a Supabase Postgres project with Row Level Security enabled on
every table, using permissive `anon` policies (this is a no-auth app by
design — see [Design decisions](#design-decisions--intentional-limitations)).

Computed stats are served by SQL views, so every read is automatically
current rather than relying on batch recomputation:

- `player_stats` — per-player win rate and effective skill level
- `tournament_standings` — per-tournament match win rate and win-rate
  tiebreak stats
- `player_match_history` — cross-tournament match history for the Overall
  Scoreboard

This repository does not include a `migrations/` or `supabase/` folder —
schema and views were applied directly to the live Supabase project. To
reproduce the schema, provision a new Supabase project and recreate the
tables/views described in [`docs/SPEC.md`](docs/SPEC.md).

## Scripts

| Script            | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                   |
| `npm run build`   | Type-check (`tsc -b`) then production build |
| `npm run lint`    | Run ESLint                                  |
| `npm run format`  | Run Prettier (writes changes)               |
| `npm run preview` | Preview the production build locally        |
| `npm run test`    | Run the Vitest test suite                   |

> **Do not use `npx tsc --noEmit`** to type-check. The root `tsconfig.json`
> has `"files": []` with only `references`, so non-build-mode `tsc` checks
> an empty file list and silently exits `0` without checking anything, even
> with real type errors present. Use `npx tsc -b` (build mode) or
> `npm run build` instead.

## Project structure

```text
src/
  features/
    players/        # player pool CRUD + stats
    tournaments/     # tournament creation and lifecycle
    matches/         # match creation, results, validation
    matchmaking/      # pure-TS matchmaking algorithm (no React/Supabase)
    scoreboard/      # per-tournament and overall scoreboard data layer
  pages/             # the 5 tab routes (Create/Active/Scoreboard/History/Member)
  components/        # shared UI components
  lib/               # Supabase client, generated DB types, shared utilities
  i18n/               # en.json / th.json locale files
```

## Testing

```bash
npm run test                              # full suite
npx vitest run src/App.test.tsx           # single file
npx vitest run -t "test name"             # single test case
```

The `matchmaking/` test suite is the most important test asset in the
project — it's the highest-risk, most heavily tested part of the codebase.

Some tests are integration tests that hit a real Supabase project
(`*.integration.test.ts`, e.g. `src/features/players/playersApi.integration.test.ts`)
and require valid `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` env vars to
pass.

## Deployment

Deployed on Vercel via the GitHub integration — pushes to `main` trigger a
deploy automatically. `vercel.json` rewrites all routes to `/index.html` for
client-side routing.

> **Watch out:** Vercel checks the pushed commit's author email against the
> connected GitHub account and **silently blocks the deploy** if they don't
> match (the push still succeeds — you have to check the Vercel dashboard to
> notice). Confirm `git config user.email` matches your GitHub account's
> verified email before pushing a commit that needs to deploy.

## Documentation map

| File                                           | Purpose                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| [`docs/SPEC.md`](docs/SPEC.md)                 | Normative product requirements — source of truth for what to build                |
| [`docs/IMPROVEMENT.md`](docs/IMPROVEMENT.md)   | UX rationale behind the 5-tab navigation rework                                   |
| [`docs/IMPROVEMENT2.md`](docs/IMPROVEMENT2.md) | Post-launch patch: matchmaking corrections, manual draw editing, History collapse |
| [`docs/PLAN.md`](docs/PLAN.md)                 | Phased implementation plan and stack decisions                                    |
| [`docs/RESEARCH.md`](docs/RESEARCH.md)         | Point-in-time snapshot of environment/account state at planning time              |
| [`CLAUDE.md`](CLAUDE.md)                       | Instructions for AI coding agents working in this repo                            |

## License

[MIT](LICENSE)
