# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phase 1 of `PLAN.md` (repo & tooling scaffold) is complete: this is a git repo with a Vite +
React + TypeScript app at the root, ESLint + Prettier, Vitest + React Testing Library, and the
target `src/` folder structure. No Supabase project, schema, or app features exist yet — that
starts at Phase 2. Before assuming later-phase tooling exists (Tailwind, react-i18next, TanStack
Query, Supabase client), check `package.json`/`src/lib/` rather than assuming from `PLAN.md` alone.

**Node version note:** the local Node is v20.13.1, below what several current package majors
require (`vite@8`+/rolldown, `eslint@10`'s dependency chain declares `^20.19`, `jsdom@30`+). Where
this caused real breakage we pinned to the last compatible major instead of the newest: `vite@^6`,
`jsdom@^26`, `react@^18` (not 19). `eslint@^10` installs and runs fine despite its engine warning.
Re-check this constraint before adding new devDependencies — an EBADENGINE warning alone is
harmless, but rolldown-style native-binding or ESM/CJS interop failures at runtime are not.

Read these three files first, in this order, before doing any implementation work:

1. **`SPEC.md`** — confirmed product requirements. Source of truth for _what_ to build.
2. **`RESEARCH.md`** — environment/account state as of planning time (Supabase org/projects, local
   tooling availability, git status). Useful for knowing what's already provisioned vs. what needs
   to be created, but re-verify rather than trusting it blindly since it's a point-in-time snapshot.
3. **`PLAN.md`** — the phased implementation plan, including stack decisions and clarifications
   that refine `SPEC.md`. This is the primary execution guide — work phase by phase, in order,
   verifying each step's stated test before moving to the next.

## Stack

- Vite 6 + React 18 + TypeScript, at the project root — **scaffolded**
- Vitest + React Testing Library for unit/component tests — **scaffolded**
- Playwright MCP for browser-driven UI/E2E verification (dev server, later the deployed URL)
- Tailwind CSS for styling — not yet installed
- `react-i18next` for the Thai/English toggle — not yet installed
- TanStack Query on top of the Supabase JS client — not yet installed
- Supabase (new project, separate from the existing unrelated inactive project in the account) with
  RLS enabled on every table using permissive `anon` policies (no-auth app by design) — not yet
  created (Phase 2)
- Deployment: Vercel, via GitHub + Vercel dashboard (no Vercel CLI/MCP available in this
  environment — confirm this hasn't changed before assuming otherwise)

Commands: `npm run dev`, `npm run build` (runs `tsc -b && vite build`), `npm run lint` (ESLint
flat config), `npm run format` (Prettier — `.prettierignore` excludes the root planning docs so it
never reformats them), `npm run test` (Vitest). Single test file: `npx vitest run
src/App.test.tsx`; single test case: `npx vitest run -t "test name"`. Type-check only: `npx tsc -b`
(build mode, not `--noEmit`). **Do not use plain `npx tsc --noEmit`** — the root `tsconfig.json`
has `"files": []` with only `references`, so non-build-mode `tsc` checks an empty file list against
the root config and silently exits 0 without checking any project files, even with real type errors
present. Only `-b`/`--build` mode (or `npm run build`, which runs `tsc -b && vite build`) actually
traverses the referenced `tsconfig.app.json`/`tsconfig.node.json` projects. This was discovered the
hard way after several steps' "clean type-check" claims turned out to be no-ops; `tsc -b --force`
surfaced real pre-existing errors once actually run.

## Architecture (target shape, per PLAN.md)

- `src/lib/` — Supabase client, generated DB types (`database.types.ts`), shared utilities
- `src/features/{players,tournaments,matches,matchmaking,standings}/` — feature-oriented modules
- `src/features/matchmaking/` — **the core algorithm, framework- and DB-free (pure TypeScript)**.
  This is explicitly the highest-risk, most heavily tested part of the codebase; its test suite
  (`generateNextMatch` and helpers) is called out in the plan as "the most important test asset in
  the project." Keep this module free of React/Supabase dependencies so it stays independently
  unit-testable.
- `src/i18n/` — `en.json`/`th.json`, locale toggle persisted to `localStorage`
- `src/components/` — shared UI components
- Supabase migrations + two SQL views (`player_stats`, `tournament_standings`) are the source of
  truth for computed win-rate, effective skill level, and standings — these are **view-driven**,
  not batch-recomputed, so every read is automatically current.

### Domain model essentials (see SPEC.md/PLAN.md for full detail)

- Central, persistent **player pool** shared across tournaments (name, gender [male/female only],
  self-selected level until 3 matches played, then win-rate-derived effective level).
- **Doubles pairs/teams are never persisted** — every tournament re-pairs individuals from the pool.
- A tournament is singles OR doubles (not both), with its own games-per-match, points-per-game, and
  a deuce cap **auto-computed from the BWF 21→30 ratio**: `cap = round(pointsPerGame * 30 / 21)`.
- Best-of-N match results that include more games than needed to decide the match (e.g. a 3rd game
  after a 2-0 sweep in best-of-3) must be **rejected** at validation, not silently accepted.
- Single-court model: matches are drawn one at a time, with the ability to pre-queue the next match
  (max 2 queued/in-progress at once).
- Matchmaking priority order (highest to lowest): equal match count → skill balance → gender
  balance → avoid repeat pairings → random choice among remaining ties. Tie-break randomness must
  never override a higher-priority criterion (e.g. it can't cross tiers of the equal-match-count
  grouping).
- Standings sort: total games won (desc), then point differential (desc), with a stable secondary
  sort for fully-tied players.
- No real-time sync — polling/manual refresh only (per SPEC.md's explicit deferral).

## Working conventions from PLAN.md

- Build in the phase order defined in `PLAN.md`; each step has an explicit "_Test:_" — treat that
  as the acceptance check for the step, not just a suggestion.
- Prefer atomic RPCs over sequential inserts where a partial failure would leave orphan rows (e.g.
  match creation across `matches` + `match_participants`).
- Use the Supabase MCP tools (`execute_sql`, `list_tables`, `get_advisors`, etc.) for schema/data
  verification during development, separate from the app's own Supabase JS client integration tests.
- Cross-check RLS policies with `get_advisors` and with real anon-key integration tests, not just
  the service-role MCP connection.
