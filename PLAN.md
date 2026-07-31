# Implementation Plan: Badminton Battle & Scoreboard

## Context

`SPEC.md` and `RESEARCH.md` (in this directory) are already confirmed and
in place. This is a greenfield build — no code exists yet, the directory
is not a git repo, and the Supabase account has one unrelated (inactive)
project but none for this app. This plan breaks the build into small,
independently-testable steps so each piece can be verified before the
next is built on top of it, rather than discovering integration problems
at the end.

**Stack decisions** (reasonable defaults for tooling choices `SPEC.md`
didn't pin down — low-stakes/reversible, not separately confirmed with
the user):

- Vite + React + TypeScript, at the project root
- Vitest + React Testing Library for unit/component tests
- Playwright MCP for browser-driven UI/E2E verification against the dev
  server and, later, the deployed URL
- Tailwind CSS for styling
- `react-i18next` for the Thai/English toggle
- TanStack Query on top of the Supabase JS client
- RLS enabled on every table with permissive `anon` policies (matches
  "no auth" while keeping a clean path to add real auth later and passing
  Supabase's security advisors)

**Decisions confirmed with the user during planning** (override/clarify
`SPEC.md` details that weren't fully pinned down):

- Gender field: **male / female only** (no third option) — simplifies
  gender-balance logic in the matchmaking algorithm.
- Deuce cap for a custom points-per-game target: **auto-computed from the
  BWF 21→30 ratio**, `cap = round(pointsPerGame * 30 / 21)`, stored on the
  tournament at creation time.
- Games-per-match config: **unchanged from SPEC.md** — organizer sets
  Best of 1 / Best of 3 / etc. per tournament. For Best-of-N with more
  games entered than needed (e.g. a 3rd game submitted after a 2-0 sweep
  already decided a best-of-3), the app **rejects the submission** with a
  validation error rather than silently accepting it.
- Matchmaking tie-break: when multiple candidate matchups score exactly
  equal on all priority criteria, the algorithm **picks randomly** among
  them — but this randomness only ever applies _within_ the group of
  players tied on the top-priority "equal match count" rule; it never
  overrides that fairness ordering.

---

## Phase 1 — Repo & Tooling Scaffold

1. [x] **Git init.** `git init`, add `.gitignore` (node_modules, dist, .env*,
       .DS_Store). _Test:_ `git status` clean/expected.
2. [x] **Vite + React + TS scaffold** at project root. _Test:_ `npm install`,
       `npm run dev` boots, default page loads (check via `curl`/Playwright MCP).
3. [x] **ESLint + Prettier.** _Test:_ `npm run lint` passes clean.
4. [x] **Vitest + React Testing Library.** One trivial smoke test. _Test:_
       `npm run test` runs and passes.
5. [x] **Folder structure:** `src/lib/`, `src/features/{players,tournaments,
       matches,matchmaking,standings}/`, `src/i18n/`, `src/components/`.
       _Test:_ `npm run build` and `npm run lint` still clean.
6. [x] **First commit.** _Test:_ `git log` shows one commit, tree clean.

## Phase 2 — Supabase Project & Schema

1. [x] **Create new Supabase project** (MCP `create_project`, under the
   existing org). Handle free-tier project-limit failure by surfacing it
   rather than touching the unrelated existing project. _Test:_
   `list_projects` shows `ACTIVE_HEALTHY`; `get_project_url` /
   `get_publishable_keys` return values.
2. [x] **Migration: `players`** — `id, name, gender ('male'|'female'),
self_selected_level ('beginner'|'intermediate'|'advanced'|'pro'),
created_at`. _Test:_ `list_tables` + `execute_sql` insert/select
   round-trip.
3. [x] **Migration: `tournaments`** — `id, type ('singles'|'doubles'),
games_per_match, points_per_game, win_by (default 2), point_cap
(computed at insert time per the BWF formula above), status
('active'|'completed'), created_at, ended_at`. _Test:_ `execute_sql`
   insert with a valid computed cap; confirm constraints reject invalid
   `type`/negative points.
4. [x] **Migration: `tournament_participants`** — `tournament_id, player_id,
joined_at`, unique `(tournament_id, player_id)`. _Test:_ `execute_sql`
   rejects a duplicate insert.
5. [x] **Migration: `matches` + `match_participants`** — `matches(id,
tournament_id, sequence_number, status 'queued'|'completed',
created_at, completed_at)`; `match_participants(match_id, player_id,
team 1|2)`, unique `(match_id, player_id)`. Enforce "exactly 2 (singles)
   or 4 (doubles) participants, 1v1 or 2v2" at the app/RPC layer (awkward
   as a pure row-level DB constraint). _Test:_ `execute_sql` seeds a fake
   singles and doubles match successfully.
6. [x] **Migration: `match_games`** — `match_id, game_number, team1_score,
team2_score`, unique `(match_id, game_number)`. _Test:_ `execute_sql`
   insert round-trip + unique constraint check.
7. [x] **Views: `player_stats`** (total_matches, total_wins, win_rate,
   effective_level — self-selected until 3 matches, then win-rate band)
   and **`tournament_standings`** (games_won, games_played, point_diff per
   participant). _Test:_ seed fake data via `execute_sql`, query the views,
   hand-verify the arithmetic, clean up seed rows.
8. [x] **RLS policies** — enable on all tables, permissive `anon` policies.
   _Test:_ `get_advisors` shows no RLS warnings; re-verified end-to-end in
   Phase 3.1 using the real anon key.
9. [x] **Generate TS types** (`generate_typescript_types` → `src/lib/
database.types.ts`). _Test:_ `tsc --noEmit` succeeds referencing them.

## Phase 3 — Core Data-Access Layer

1. [x] **Supabase client** (`src/lib/supabaseClient.ts`, env-driven). _Test:_
   Vitest integration test hitting the real project with the anon key —
   first proof RLS policies actually work from the client, not just the
   service-role MCP connection.
2. [x] **Players API** (list/create/update/getStats). _Test:_ integration
   tests against the real project (create → appears in list → stats show
   0 matches/self-selected level for a new player); clean up test rows.
3. [x] **Tournaments API** (create w/ computed cap, list, addParticipant,
   listParticipants, endTournament). _Test:_ integration test verifying
   the stored cap matches the formula, and status flips on end.
4. [x] **Matches/scoring API** (createMatch via an atomic RPC, recordMatchResult,
   getMatchHistory for repeat-pairing checks, getStandings). _Test:_
   integration test: seed a doubles match, record games, re-read standings,
   assert correct games_won/point_diff; verify no orphan `matches` row if
   `match_participants` insert fails (hence the RPC, not sequential inserts).
5. [x] **TanStack Query hook conventions** (`usePlayers`, etc.), reused by all
   later UI phases. _Test:_ one hook rendered in a throwaway RTL test with
   a mocked client, asserting loading → success.

## Phase 4 — Player Pool Management UI

1. [x] **Player list view.** _Test:_ Playwright MCP against dev server with
   MCP-seeded players; confirm names/levels render.
2. [x] **Create player form** (name, gender select, self-selected level select).
   _Test:_ RTL unit test (valid submit calls API; empty name blocked) +
   Playwright MCP round-trip verified via `execute_sql`.
3. [x] **Edit player** (level field editable only while `total_matches < 3`).
   _Test:_ RTL test for both states; Playwright MCP edit-and-persist check.
4. [x] **`getEffectiveLevel(player, stats)` pure helper** (mirrors the SQL view
   for UI display). _Test:_ Vitest unit tests across match-count and
   win-rate-band boundaries (0/25/50/75/100%).

## Phase 5 — Tournament Creation UI/Flow

1. [x] **Creation form** (name, type, games/match, points/game, live-computed
   cap display). _Test:_ RTL test — cap updates as points/game changes;
   submit payload correct.
2. [x] **Tournament list/detail shell** (active vs completed; Participants /
   Draw / Standings sections). _Test:_ Playwright MCP create-and-view flow,
   cross-checked via `execute_sql`.
3. [x] **Add participant to in-progress tournament** (search existing pool +
   inline create-new-player shortcut). _Test:_ Playwright MCP add-player
   flow, confirmed via `execute_sql`.
4. [x] **End tournament action.** _Test:_ RTL test (draw/record controls
   disabled once completed) + Playwright MCP real click-through.

## Phase 6 — Matchmaking Algorithm (pure, framework-free, highest test priority)

Lives entirely in `src/features/matchmaking/` as plain TypeScript —
no DB/React dependency, so it's fully unit-testable.

1. [x] **Types.** `CandidatePlayer{id, gender:'male'|'female', skillValue:
0-100, matchesPlayedInTournament}`, `PairingHistory{opponentPairs,
teammatePairs: Set<canonical-id-pair>}`. _Test:_ `tsc --noEmit` only.
2. [x] **`resolveSkillValue(player)`** — real win rate if global
   `totalMatches >= 3`, else self-selected category midpoint (12.5 / 37.5
   / 62.5 / 87.5). _Test:_ unit tests at the exact 3-match boundary and
   each category midpoint.
3. [x] **`selectCandidatePool(players, neededCount)`** — lowest match-count
   tier first, expanding to the next tier if too small; explicit
   "not enough players" result (never throws) if the whole tournament has
   fewer than `neededCount` participants. _Test:_ exact-fit, tier-expansion,
   and not-enough-players unit tests.
4. [x] **Singles: `pickSinglesPair(pool)`** — score all pairs by skill-gap;
   among top-tied pairs, prefer same-gender (since male/female-only makes
   "mixed" the one case to avoid when an alternative exists); among what's
   left, prefer non-repeat opponents, falling back to a repeat only if
   every remaining option is a repeat; **random pick among final ties**.
   _Test:_ unit tests per stage (skill-best chosen; gender tiebreak;
   repeat-avoidance-with-fallback; confirm equal-match-count pool from
   step 3 is never violated by later stages).
5. [x] **Doubles: `pickDoublesQuartet(pool)` + `splitIntoTeams(quartet)`** —
   quartet selection favors skill-spread + even gender split within the
   candidate pool; team split evaluates all 3 possible 2v2 splits, skill-sum
   balance first, gender balance (1 male + 1 female per team when possible)
   as a tiebreak, repeat-teammate/repeat-opponent avoidance as a further
   tiebreak, random choice among final ties. _Test:_ unit tests per stage
   with synthetic 6-8 player pools, including a case where best-skill-split
   and best-gender-split disagree (skill wins, per priority order).
6. [x] **`generateNextMatch(type, participants, pairingHistory)`** — composes
   the above into one entry point returning either a match or
   `{error:'not_enough_players'}`. _Test:_ comprehensive scenario suite —
   fresh tournament first draw, uneven match counts, newly-added player
   drawn first, forced repeats after exhausting combinations, doubles with
   skewed gender ratio (e.g. 5 male/1 female). **This suite is the most
   important test asset in the project — allocate real time here.**

## Phase 7 — Match Generation UI

1. [x] **`useDrawInputs(tournamentId)`** — assembles `CandidatePlayer[]` and
   `PairingHistory` from `tournament_participants` + `player_stats` +
   this-tournament match history. _Test:_ integration test against a
   seeded fixture tournament, hand-verified counts/history.
2. [x] **"Draw next match" button** → `generateNextMatch()` → persist via
   `createMatch()` (status `queued`). _Test:_ RTL test with a mocked
   algorithm; Playwright MCP real click verified via `execute_sql`.
3. [x] **Current vs. queued match display**, single-court rule (draw disabled
   once 2 matches are queued/in-progress). _Test:_ RTL tests across 0/1/2
   queued states.
4. [x] **Not-enough-players UI state.** _Test:_ RTL test with an under-sized
   participant pool shows a clear message, no crash.

## Phase 8 — Match Result Entry + Scoring Validation

1. [x] **`validateGameScore(score1, score2, {pointsPerGame, winBy, cap})`** —
   pure function. _Test:_ unit tests: normal win, win-by-1 (invalid),
   deuce win, cap win (valid despite <winBy margin at the cap), over-cap
   score (invalid).
2. [x] **`validateMatchGames(games[], gamesPerMatch)`** — checks game count
   matches a valid best-of-N outcome; **rejects** extra/trailing games
   submitted after the match was already decided (per confirmed decision
   above). _Test:_ decided-in-minimum-games (valid), decided-with-full-games
   (valid), under-decided (invalid), over-decided/extra games (invalid).
3. [x] **Result entry form** (dynamic per-game rows up to `gamesPerMatch`,
   inline validation, submit disabled until valid). _Test:_ RTL — invalid
   entry blocks submit with visible error; valid entry submits correct
   payload.
4. [x] **Persist + free the court** (mark `completed`, promote queued match to
   current). _Test:_ Playwright MCP real submission, verified via
   `execute_sql`; UI correctly promotes the queued match.

## Phase 9 — Standings/Leaderboard

1. [x] **Standings table** reading `tournament_standings`, sorted games-won
   desc then point-diff desc. _Test:_ integration test against seeded
   fixture data, including a tie broken by point differential.
2. [x] **Refresh mechanism** — periodic poll (~30s) per the "no real-time"
   spec decision, since the user already chose polling/manual-refresh over
   live sync during the interview. _Test:_ RTL test confirming the poll
   interval triggers a refetch.
3. [x] **Edge cases** — empty tournament state; stable secondary sort (e.g. by
   player id) so fully-tied players don't flicker order between refreshes.
   _Test:_ RTL test with two fully-tied players, deterministic order across
   repeated renders.

## Phase 10 — Win-Rate / Skill-Level Recomputation

1. [x] Confirm this is **view-driven** (Phase 2.7), not a batch job — every
   read is automatically current. _Test:_ integration regression test —
   record a result, immediately re-query `player_stats`, confirm no lag.
2. [x] **Cutover at exactly 3 matches.** _Test:_ integration test — 2 matches
   → still self-selected level; 3rd match recorded → `effective_level`
   switches to the win-rate-band value.
3. [x] **UI reflects the switch without manual refresh** (query invalidation
   on the affected player after `recordMatchResult`). _Test:_ Playwright
   MCP — record a player's 3rd match through the real UI, confirm the
   players list shows the computed-level badge without a page reload.

## Phase 11 — i18n (Thai/English)

1. [x] **Setup** — `react-i18next`, `en.json`/`th.json`, toggle persisted to
   `localStorage`. _Test:_ unit test rendering under both locales.
2. [x] **Extract all UI strings** built in Phases 4-9. _Test:_ grep-based check
   for leftover literal JSX strings; Playwright MCP toggle + screenshot
   comparison.
3. [x] **Locale-aware date formatting** where relevant. _Test:_ unit test per
   locale.

## Phase 12 — Deployment to Vercel

1. [x] **Push to GitHub** (no Vercel CLI/MCP available per `RESEARCH.md`, so
   this is the viable path). _Test:_ `git remote -v`, repo visible on
   GitHub with expected files.
2. [x] **User connects the repo in the Vercel dashboard** (their own auth —
   not something this session can perform), sets `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from the MCP `get_project_url`/
   `get_publishable_keys` output. _Test:_ Vercel build log succeeds; app
   shell loads at the generated URL.
3. [x] **Post-deploy smoke test** — Playwright MCP (or claude-in-chrome MCP)
   against the live URL: create player → create tournament → add
   participants → draw match → record result → standings update →
   language toggle. Cross-check final DB state via `execute_sql` against
   the production project.
4. [x] **Fix stale query-cache bug found in smoke test.** `useAddParticipant`
   (`src/features/tournaments/useAddParticipant.ts`) only invalidates
   `['tournamentParticipants', tournamentId]`, not `['drawInputs',
   tournamentId]` — so the Draw section keeps showing the pre-add
   participant count (and a wrongly-disabled "Draw next match" button)
   until a manual page reload. `useRecordMatchResult`
   (`src/features/matches/useRecordMatchResult.ts`) invalidates
   `['matches', ...]`, `['drawInputs', ...]`, `['playerStats']` but not
   `['standings', tournamentId]` — so the Standings table keeps showing
   stale 0/0/0 rows after a result is recorded until reload. DB state is
   correct in both cases; this is UI-only. Add the missing
   `invalidateQueries` calls in both hooks. _Test:_ Playwright MCP —
   add a participant without reloading and confirm the Draw section
   picks it up immediately; record a match result without reloading and
   confirm Standings updates immediately.
5. **Final security check** — `get_advisors` + `get_logs` spot-check for
   regressions/errors from the smoke-test traffic.

---

## Critical Files

- `SPEC.md`, `RESEARCH.md` — source of truth for requirements/environment
- `src/features/matchmaking/generateNextMatch.ts` (+ helpers) — the core
  algorithm; highest-risk, most heavily tested piece
- `src/lib/database.types.ts` — generated Supabase types underpinning the
  data-access layer
- Supabase migrations / `player_stats` & `tournament_standings` views —
  source of truth for win-rate, skill level, and standings

## End-to-End Verification

After Phase 12, the full critical path (create player → create tournament
→ add participants → draw matches → record results with valid/invalid
scores → watch standings and skill levels update → toggle language) will
have been exercised at three levels: pure-logic unit tests (Vitest, no
I/O), integration tests against the real Supabase project (via the JS
client and cross-checked with the Supabase MCP tools), and full
browser-driven runs via Playwright MCP against both the local dev server
and the deployed Vercel URL.
