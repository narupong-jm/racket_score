# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phases 1-12 of `PLAN.md` are complete: the app is built, deployed to Vercel, and was functioning
as a single-scroll page (all Players/Tournaments content on one screen, no router). Phase 13 is a
**navigation and flow overhaul** — currently unimplemented (all steps unchecked) — replacing that
single page with a 5-tab bottom-navigation structure (Create / Active / Scoreboard / History /
Member), per `IMPROVEMENT.md` (a user-authored concept doc; read it for the full rationale/mockup
references behind Phase 13's design — `SPEC.md` §3-§9 were rewritten to match it and are the
normative version, but `IMPROVEMENT.md` explains *why*). Phase 13 went through two earlier,
narrower drafts (3-page, then 4-page) before this one — if you see references to those in old
conversation history, they're superseded; `PLAN.md`'s current Phase 13 section is the only one
that matters. Before assuming any Phase-13-era tooling exists (`react-router-dom`, the icon-picker
component, the scoreboard views), check `package.json`/`src/` rather than assuming from `PLAN.md`
alone — none of it exists yet as of this note.

**Node version note:** the local Node is v20.13.1, below what several current package majors
require (`vite@8`+/rolldown, `eslint@10`'s dependency chain declares `^20.19`, `jsdom@30`+). Where
this caused real breakage we pinned to the last compatible major instead of the newest: `vite@^6`,
`jsdom@^26`, `react@^18` (not 19). `eslint@^10` installs and runs fine despite its engine warning.
Re-check this constraint before adding new devDependencies — an EBADENGINE warning alone is
harmless, but rolldown-style native-binding or ESM/CJS interop failures at runtime are not.

Read these files first, in this order, before doing any implementation work:

1. **`SPEC.md`** — confirmed product requirements. Source of truth for _what_ to build. Carries
   dated "Updated" notes at the top tracking each revision — read those before trusting any single
   section, since some (§3-§9) have been rewritten more than once.
2. **`IMPROVEMENT.md`** — the concept doc behind `SPEC.md`'s current §3-§9 and `PLAN.md`'s current
   Phase 13. Not itself normative (SPEC.md is), but explains the UI/UX reasoning and references a
   mockup that isn't reproduced in `SPEC.md`'s prose.
3. **`RESEARCH.md`** — environment/account state as of planning time (Supabase org/projects, local
   tooling availability, git status). Useful for knowing what's already provisioned vs. what needs
   to be created, but re-verify rather than trusting it blindly since it's a point-in-time snapshot.
4. **`PLAN.md`** — the phased implementation plan, including stack decisions and clarifications
   that refine `SPEC.md`. This is the primary execution guide — work phase by phase, in order,
   verifying each step's stated test before moving to the next.

## Stack

- Vite 6 + React 18 + TypeScript, at the project root — **scaffolded**
- Vitest + React Testing Library for unit/component tests — **scaffolded**
- Playwright MCP for browser-driven UI/E2E verification (dev server, later the deployed URL)
- `react-i18next` for the Thai/English toggle — **installed** (Phase 11)
- TanStack Query on top of the Supabase JS client — **installed** (Phase 3)
- `react-router-dom` (`^7.x`) — **not yet installed**; needed starting Phase 13 step 1 for the
  5-tab bottom-navigation structure. No routing exists in the app before this.
- Tailwind CSS — **never adopted**; the app uses plain CSS (`src/index.css`, custom properties for
  light/dark theming) instead. Don't assume Tailwind classes work.
- Supabase (project `racket-score`, separate from the unrelated inactive project in the account),
  RLS enabled on every table using permissive `anon` policies (no-auth app by design) — **created
  and live** (Phase 2); see `src/lib/supabaseClient.ts`/`database.types.ts`.
- Deployment: Vercel, via GitHub + Vercel dashboard (no Vercel CLI/MCP available in this
  environment — confirm this hasn't changed before assuming otherwise). **Live** at the URL the
  user provided during Phase 12 — ask them for it again if you don't have it in context, don't
  guess/construct a Vercel URL.

**Git author email / Vercel deploy note:** the local git identity was auto-configured to
`j.nrup@Js-MacBook-Air.local` (a machine-generated placeholder, not a real address), which is not
one of the GitHub account's verified emails. Vercel's GitHub integration checks the pushed commit's
author email against the connected GitHub account and **silently blocks the deploy** ("Deployment
Blocked: The commit author email ... is not a valid email") if they don't match — the push to
`origin/main` still succeeds, so this is easy to miss; you have to check the Vercel dashboard to see
it. Before pushing a commit that needs to actually deploy, confirm `git config user.email` is set to
the GitHub account's verified email (e.g. via `gh api user` — note the public `email` field is often
`null` if private, so ask the user to confirm rather than guessing). If a bad-author commit already
reached `origin/main`, the fix is `git config user.email <verified-email>` then `git commit --amend
--reset-author --no-edit` and `git push --force-with-lease` — confirm with the user first since it
rewrites already-pushed history on the shared branch.

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
- `src/features/{players,tournaments,matches,matchmaking,scoreboard}/` — feature-oriented modules
  (`scoreboard/` is new as of Phase 13, for the cross-tournament Overall Scoreboard's data layer)
- `src/features/matchmaking/` — **the core algorithm, framework- and DB-free (pure TypeScript)**.
  This is explicitly the highest-risk, most heavily tested part of the codebase; its test suite
  (`generateNextMatch` and helpers) is called out in the plan as "the most important test asset in
  the project." Keep this module free of React/Supabase dependencies so it stays independently
  unit-testable.
- `src/i18n/` — `en.json`/`th.json`, locale toggle persisted to `localStorage`
- `src/components/` — shared UI components
- Supabase migrations + SQL views (`player_stats`, `tournament_standings`, and — as of Phase 13 —
  `player_match_history`) are the source of truth for computed win-rate, effective skill level, and
  scoreboards — these are **view-driven**, not batch-recomputed, so every read is automatically
  current. As of Phase 13, `tournament_standings` also carries `matches_won`/`win_rate` columns
  (added on top of its original `games_won`/`point_diff` columns) — the win-rate columns back the
  new Tournament Scoreboard; the games/point-diff columns are now otherwise unused by the UI (the
  old in-progress "Standings" screen that read them was deleted) but were left in the view rather
  than removed, since other things may still reference them.

### Domain model essentials (see SPEC.md/PLAN.md for full detail)

- Central, persistent **player pool** shared across tournaments (name, gender [male/female only],
  self-selected level until 3 matches played, then win-rate-derived effective level). Displayed
  everywhere with a **generated placeholder avatar** (initials + name-derived color) — there is no
  photo upload or `players.photo`/`avatar_url` column; don't add one without the user explicitly
  asking, per `SPEC.md` §3's deferral.
- **Doubles pairs/teams are never persisted** — every tournament re-pairs individuals from the pool.
- **Participants are chosen once, at tournament-creation time, from the member pool — never
  after.** There is deliberately no "add a late player to an in-progress tournament" feature (it
  existed early on and was explicitly removed — see `SPEC.md` §4 and Phase 13's step 2). Don't
  reintroduce it without being asked.
- A tournament is singles OR doubles (not both), with its own games-per-match, points-per-game, and
  a deuce cap **auto-computed from the BWF 21→30 ratio**: `cap = round(pointsPerGame * 30 / 21)`.
  There is **no fixed total round/match count** — a tournament runs until the organizer manually
  ends it; UI showing round progress must say "Round N", never "Round N of M".
- Best-of-N match results that include more games than needed to decide the match (e.g. a 3rd game
  after a 2-0 sweep in best-of-3) must be **rejected** at validation, not silently accepted.
- Once a match result is confirmed (via the confirm-before-save dialog), it is **permanently
  locked** — no edit UI, no admin override, anywhere in the app. This is deliberate, not a
  to-do.
- Single-court model: matches are drawn one at a time. As of Phase 13, drawing is split into two
  explicit, independently-managed slots in the Manage Tournament screen — **Next match** (filled
  only by an explicit "Randomize" tap, one match type's needed-player-count via
  `getNeededPlayerCount`) and **Current match** (only populated by an explicit "Start match" tap
  that promotes whatever's in Next; never auto-promoted when a result is confirmed). The
  tournament's very first match is the one exception — it's auto-drawn immediately at creation
  time, with a confirmation popup, before the organizer ever sees the Manage screen.
- Matchmaking priority order (highest to lowest): equal match count → skill balance → gender
  balance → avoid repeat pairings → random choice among remaining ties. Tie-break randomness must
  never override a higher-priority criterion (e.g. it can't cross tiers of the equal-match-count
  grouping).
- **Two distinct scoreboards, both win-rate-based** (as of Phase 13 — the earlier games-won/
  point-diff "Standings" screen was deleted): a **per-tournament Scoreboard** (match win rate within
  one tournament, tiebreak by point differential) that works identically whether the tournament is
  active or ended, and a separate **Overall Scoreboard** (match win rate across *all* of a player's
  matches in *all* tournaments, with independent period [all-time/this-month] and match-type
  [all/singles/doubles] filters, and a cumulative *total points scored* column instead of point
  differential). Don't conflate the two — they use different views/queries and different "points"
  semantics.
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
