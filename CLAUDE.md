# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phases 1-24 of `docs/PLAN.md` are complete (Phase 24 per the note below), including Phase 13's 5-tab bottom-nav
overhaul (Create / Active / Scoreboard / History / Member) and every IMPROVEMENT-doc-driven patch
(`docs/IMPROVEMENT.md` through `docs/IMPROVEMENT4.md` — all four are fully absorbed into shipped
phases: IMPROVEMENT.md → Phase 13, IMPROVEMENT2.md → Phase 14, IMPROVEMENT3.md → Phase 18,
IMPROVEMENT4.md → Phase 20; nothing in any of them is still outstanding). Phases 21-24 then shipped
without a numbered IMPROVEMENT doc of their own (driven directly by `docs/SPEC.md`'s dated "Updated"
notes instead). Do not assume from old conversation history or partial doc reads that any of this
is still in flight — check `docs/PLAN.md`'s phase checkboxes (all `[x]`) and `src/` directly if in
doubt.

**Most recent phase — Phase 24, multi-court tournaments:** replaces the single-court model.
A tournament now has `court_count` (1-8, chosen on the Create form, fixed afterward; pre-existing
tournaments = 1) and `matches.court_number`; `matches.status = 'queued'` still means *in progress*
(at most one per court, via a partial unique index). RPCs: `create_tournament(... p_court_count ...)`
and `create_match(p_tournament_id, p_participants, p_court_number, p_passphrase,
p_manually_adjusted)`, which computes `sequence_number` server-side and raises
`tournament_not_active` / `invalid_court` / `court_occupied` / `participant_on_court`. The drawn-but-
not-started **queue** (max `court_count + 1`) is client-side, in `localStorage` per tournament
(`src/lib/matchQueueStore.ts`, key `racket-score.matchQueue.<id>`, the legacy single-draw key is
migrated), read via `useMatchQueueDrafts` (`useSyncExternalStore`); `useStartMatchOnCourt` starts the
queue head on a free court. The queue is per browser. Matchmaking feeds the unchanged
`generateNextMatch` with *planned* match counts via `src/features/matchmaking/plannedMatches.ts`
(`applyPlannedMatches`, `findReusedPlayerIds`, `drawMatches`). **Migration state to check:**
`phase24_multi_court_schema` and `phase24_multi_court_rpcs` were applied additively (the OLD
`create_tournament`/`create_match` overloads still exist in the live DB); the cleanup migration
("2b" in `docs/PLAN.md` Phase 24 — drops the old overloads, adds a unique index on
`(tournament_id, sequence_number)`) is to be applied at merge time, so run `list_migrations` first
thing to see whether it has landed. PLAN.md's step 12 (full regression + live Playwright pass) is the
remaining verification. The integration-test fixture cleanup rule (controller runs the UUID-regex
`execute_sql` pass; subagents never do) still applies. `docs/SPEC.md` §4-§6/§9 and its "Updated:
2026-10-08" note describe the built behavior.

**Phase 23, delete a confirmed match result:** reverses the previous
"permanently locked, no admin-override" rule for whole-match deletion only (in-place score editing
is still unsupported). A passphrase-gated confirm dialog previews per-player stat impact before
deleting; reachable from History (any match, any tournament, active or ended) or as a "delete last
match" quick-undo on the Manage screen's newest Matches-played row immediately after confirming a
result. Hard delete of the match + games + participants — doesn't renumber `sequence_number` or
restore court/queue state. `docs/SPEC.md` §6 and its "Updated: 2026-09-14" note describe this as
the current target state and are accurate as of this note.

Two intermediate phases, for context: **Phase 21** (Create Tournament form refinements — blank-by-
default stepper inputs for games/match and points/game, Tennis's points-per-game fixed at 4 and
shown disabled rather than hidden) and **Phase 22** (Next-match Edit popup gained a read-only
games-played reference table, and an un-started Next-match draw now persists to `localStorage` per
tournament so navigating away doesn't lose it — both since carried over into Phase 24's queue).

**Node version note:** the local Node is v20.13.1, below what several current package majors
require (`vite@8`+/rolldown, `eslint@10`'s dependency chain declares `^20.19`, `jsdom@30`+). Where
this caused real breakage we pinned to the last compatible major instead of the newest: `vite@^6`,
`jsdom@^26`, `react@^18` (not 19). `eslint@^10` installs and runs fine despite its engine warning.
Re-check this constraint before adding new devDependencies — an EBADENGINE warning alone is
harmless, but rolldown-style native-binding or ESM/CJS interop failures at runtime are not.

Read these files first, in this order, before doing any implementation work:

1. **`docs/SPEC.md`** — confirmed product requirements. Source of truth for _what_ to build. Carries
   dated "Updated" notes at the top tracking each revision — read those before trusting any single
   section, since some (§3-§9) have been rewritten more than once. Note: each "Updated" note's own
   trailing "Not yet implemented as of this note" caveat describes status *at spec-revision time*,
   not now — every one of them has since shipped (cross-check `docs/PLAN.md`'s phase checkboxes, not
   the caveat text, for current status).
2. **`docs/PLAN.md`** — the phased implementation plan, including stack decisions and clarifications
   that refine `docs/SPEC.md`. This is the primary execution guide and the authoritative record of
   what's actually shipped — work phase by phase, in order, verifying each step's stated test before
   moving to the next.
3. **`docs/IMPROVEMENT.md`/`IMPROVEMENT2.md`/`IMPROVEMENT3.md`/`IMPROVEMENT4.md`** — historical concept
   docs, each the design rationale behind one already-shipped phase (`IMPROVEMENT.md` → Phase 13,
   `IMPROVEMENT2.md` → Phase 14, `IMPROVEMENT3.md` → Phase 18, `IMPROVEMENT4.md` → Phase 20). Not
   normative and not in-flight — read whichever one matches the phase you're touching for the
   UI/UX/schema reasoning behind it, but trust `docs/PLAN.md`'s checkboxes and `src/` over anything
   in these phrased as a future/pending change.
4. **`docs/RESEARCH.md`** — environment/account state as of planning time (Supabase org/projects, local
   tooling availability, git status). Useful for knowing what's already provisioned vs. what needs
   to be created, but re-verify rather than trusting it blindly since it's a point-in-time snapshot.

## Stack

- Vite 6 + React 18 + TypeScript, at the project root — **scaffolded**
- Vitest + React Testing Library for unit/component tests — **scaffolded**
- Playwright MCP for browser-driven UI/E2E verification (dev server, later the deployed URL)
- `react-i18next` for the Thai/English toggle — **installed** (Phase 11)
- TanStack Query on top of the Supabase JS client — **installed** (Phase 3)
- `react-router-dom` (`^7.x`) — **installed** (Phase 13); drives the 5-tab bottom-navigation
  structure plus the Phase 20 `/home` sport-picker route.
- Tailwind CSS — **never adopted**; the app uses plain CSS (`src/index.css`, custom properties for
  light/dark theming) instead. Don't assume Tailwind classes work.
- Supabase (project `racket-score`, separate from the unrelated inactive project in the account),
  RLS enabled on every table using permissive `anon` policies (no-auth app by design) — **created
  and live** (Phase 2); see `src/lib/supabaseClient.ts`/`database.types.ts`.
- Deployment: Vercel, via GitHub + Vercel dashboard. A Vercel MCP connector (`claude.ai Vercel`) is
  now available too (confirmed working during the Phase 14 patch, 2026-07-31) — it needs an
  interactive OAuth step the first time in a session (calling its `authenticate` tool returns
  instructions to ask the user to run `/mcp` and select "claude.ai Vercel"; this cannot be
  completed non-interactively). Once connected: team `nrup-mm`
  (`team_5rCNsosyamIm9vbTbgMLg5s5`), project `racket-score` (`prj_dSp3IzBqxjv9hntdiXaQUL4ZPtrO`) —
  use `list_deployments`/`get_deployment`/`get_deployment_build_logs` to check build/deploy status
  directly instead of asking the user to check the dashboard manually. Still don't
  guess/construct a Vercel deployment URL from scratch — read it from `list_deployments`/
  `get_project` (or ask the user) instead.

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

## Architecture (target shape, per docs/PLAN.md)

- `src/lib/` — Supabase client, generated DB types (`database.types.ts`), shared utilities
- `src/features/{players,tournaments,matches,matchmaking,scoreboard,sport}/` — feature-oriented
  modules (`scoreboard/` is new as of Phase 13, for the cross-tournament Overall Scoreboard's data
  layer; `sport/` is new as of Phase 20 — `SportContext`/`SportProvider`/`useSport`, mirroring the
  `features/passphrase/` context/provider/hook shape, backed by `src/lib/sportStore.ts`
  (`localStorage`, unlike the passphrase gate's `sessionStorage`, since the chosen sport persists
  across restarts); as of Phase 24 the multi-court queue lives in `src/lib/matchQueueStore.ts`
  (`localStorage`, per tournament) with its hooks in `features/matches/` — `useMatchQueueDrafts`,
  `useStartMatchOnCourt`)
- `src/features/matchmaking/` — **the core algorithm, framework- and DB-free (pure TypeScript)**.
  This is explicitly the highest-risk, most heavily tested part of the codebase; its test suite
  (`generateNextMatch` and helpers) is called out in the plan as "the most important test asset in
  the project." Keep this module free of React/Supabase dependencies so it stays independently
  unit-testable. `plannedMatches.ts` (Phase 24 — `applyPlannedMatches`, `findReusedPlayerIds`,
  `drawMatches`) lives here too: pure helpers that turn in-progress + queued rosters into planned
  match counts/pairings before calling `generateNextMatch`.
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

### Domain model essentials (see docs/SPEC.md / docs/PLAN.md for full detail)

- Central, persistent **player pool** shared across tournaments **and across both sports** (name,
  gender [male/female only], self-selected level until 3 matches played, then win-rate-derived
  effective level). As of Phase 20, level and stats are tracked **independently per sport** —
  `players.badminton_self_selected_level`/`tennis_self_selected_level` are separate nullable
  columns (there is no single `self_selected_level` column anymore), and `player_stats` is a
  sport-scoped view (2 rows per player: `sport` is part of its key, along with `player_id`).
  Displayed everywhere with a **generated placeholder avatar** (initials + name-derived color) —
  there is no photo upload or `players.photo`/`avatar_url` column; don't add one without the user
  explicitly asking, per `docs/SPEC.md` §3's deferral.
- **Doubles pairs/teams are never persisted** — every tournament re-pairs individuals from the pool.
- **Participants start from a roster chosen once at tournament-creation time**, but — as of Phase
  18 (`docs/IMPROVEMENT3.md`), a **deliberate reversal** of the original "never after" rule that
  Phase 13 had introduced — the roster can change mid-tournament via two guarded actions: an active
  participant can **Leave** (soft-remove, reversible, blocked while they're in the in-progress
  match on any court or once the tournament has ended/been cancelled; immediately excluded from the
  Match Generator's candidate pool, but History/Scoreboard are untouched since those read
  completed-match data, not the roster) and the organizer can **Add participant** to bring in a late
  arrival or rejoin someone who left (reuses the same `tournament_participants` row rather than
  duplicating it; the new/returning participant gets a fairness `match_count_offset` equal to the
  current minimum matches-played among active participants, so the draw doesn't penalize them for
  joining late — this offset only feeds the matchmaking algorithm, never History/Scoreboard/win-rate,
  which always reflect real completed matches). Both actions are passphrase-gated, same as every
  other write. See `docs/SPEC.md` §4 for full detail.
- A tournament is singles OR doubles (not both), with its own games-per-match, points-per-game, and
  a deuce cap **auto-computed from the BWF 21→30 ratio**: `cap = round(pointsPerGame * 30 / 21)`.
  There is **no fixed total round/match count** — a tournament runs until the organizer manually
  ends it; UI showing progress must say "Match N", never "Match N of M" (the pre-Phase-24 "Round N"
  labels are gone).
- Best-of-N match results that include more games than needed to decide the match (e.g. a 3rd game
  after a 2-0 sweep in best-of-3) must be **rejected** at validation, not silently accepted.
- Once a match **result** is confirmed (via the confirm-before-save dialog), its **scores are
  permanently locked** — no edit UI, no admin override to change them, anywhere in the app. This is
  deliberate, not a to-do. As of Phase 23, a confirmed match *can* be permanently **deleted**
  (not edited) via a passphrase-gated confirm dialog that previews per-player stat impact —
  reachable from History (any match, any tournament) or as a "delete last match" quick-undo on the
  Manage screen right after confirming a result (see "Project status" above for the full picture).
  Separately (per `docs/IMPROVEMENT2.md` §2, Phase 14), a match that's been drawn but **not yet
  started** — one of the auto-drawn first matches in the creation-time confirmation popup, or any
  entry in the Manage screen's queue before it is started — can have its players edited inline, swapping a drawn player for
  someone else in the tournament's roster. This only touches the *draw*, never a confirmed *result*;
  the UI warns but does not block if the edited lineup violates the gender-balance rule below, and
  the edited match is flagged as manually-adjusted (visible later in History).
- Multi-court model (Phase 24, replacing the Phase 13 single-court Next/Current slots): a tournament
  has 1-8 courts, each with at most one in-progress match; drawn-but-not-started matches wait in one
  shared **queue** (max courts + 1) filled only by explicit "Randomize"/"Fill queue" taps (each draw
  is one match's `getNeededPlayerCount`). "Start match" on a free court moves the queue head onto it
  — never auto-started or auto-promoted when a result is confirmed. The tournament's first n matches
  (n = courts) are the one exception: they are drawn at creation time, shown in a confirmation
  popup, and placed in the queue (still not auto-started). Per-court Save is locked while the queue
  is empty unless that court's "Is last match" is ticked; Start is blocked if a head player is on
  another court. Labels are "Match N" (plus "· Court X" when courts > 1), never "Round N".
- Matchmaking priority order (highest to lowest): **equal match count** (per `docs/IMPROVEMENT2.md`
  §1.1, implemented in Phase 14, this is a **hard invariant** — the gap between the most- and
  least-played participant must never exceed 1; when the lowest-count tier is short of the needed
  player count, every player in that tier is drawn and only the remaining seats are filled from the
  next tier) → skill balance → gender balance → avoid repeat pairings → random choice among
  remaining ties. Tie-break randomness must never override a higher-priority criterion (e.g. it
  can't cross tiers of the equal-match-count grouping). **Doubles is a special case** (per
  `docs/IMPROVEMENT2.md` §1.2, implemented in Phase 14): gender balance (2-male-2-female quartets/team
  splits over any unbalanced alternative) is promoted to a **hard filter above skill balance**, not
  a tiebreak — so for doubles the effective order is equal match count → gender balance (hard) →
  skill balance → avoid repeat pairings; singles is unaffected. **Planned counts** (Phase 24, replacing
  `docs/IMPROVEMENT2.md` §1.3's Current-match exclusion): the fairness count is completed +
  in-progress (any court) + already-queued matches, so committed players are drawn later; a player
  is only reused across queued/in-progress matches when too few others remain, with a UI warning
  derived from the queue each render. Leave/Add participant offsets still use completed matches
  only (known limitation).
- **Two distinct scoreboards, both win-rate-based** (as of Phase 13 — the earlier games-won/
  point-diff "Standings" screen was deleted): a **per-tournament Scoreboard** (match win rate within
  one tournament, tiebreak by point differential) that works identically whether the tournament is
  active or ended, and a separate **Overall Scoreboard** (match win rate across *all* of a player's
  matches in *all* tournaments, with independent period [all-time/this-month] and match-type
  [all/singles/doubles] filters, and a cumulative *total points scored* column instead of point
  differential). Don't conflate the two — they use different views/queries and different "points"
  semantics.
- No real-time sync — polling/manual refresh only (per docs/SPEC.md's explicit deferral).

## Working conventions from docs/PLAN.md

- Build in the phase order defined in `docs/PLAN.md`; each step has an explicit "_Test:_" — treat that
  as the acceptance check for the step, not just a suggestion.
- Prefer atomic RPCs over sequential inserts where a partial failure would leave orphan rows (e.g.
  match creation across `matches` + `match_participants`).
- Use the Supabase MCP tools (`execute_sql`, `list_tables`, `get_advisors`, etc.) for schema/data
  verification during development, separate from the app's own Supabase JS client integration tests.
- Cross-check RLS policies with `get_advisors` and with real anon-key integration tests, not just
  the service-role MCP connection.
