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
5. [x] **Final security check** — `get_advisors` + `get_logs` spot-check for
   regressions/errors from the smoke-test traffic.

## Phase 13 — 5-Tab Navigation Rework (Create / Active / Scoreboard /
## History / Member)

Superseded twice before any code was written: first drafted as a 3-page
nav, then revised to 4 pages, and now fully replaced per `IMPROVEMENT.md`
(a user-authored concept doc) with a **5-tab bottom-navigation** structure
and several behavior changes that also required revising `SPEC.md` §3-§9
(see that file's 2026-07-31 "later same day" update note). This is a
navigation/flow overhaul, not a patch — most of the previous draft's
pages/routes are gone, though several lower-level pieces (the `IconChoice`
picker, the `Modal` component, the win-rate view extension, the
create-tournament-with-first-draw orchestration) carry over unchanged in
design, just wired into new pages.

**Tabs, always at the bottom of the viewport at every screen size (not a
responsive top-nav):** 1) **Create** — new-tournament form incl. the
participant checklist (the *only* place participants are ever chosen —
see below) — 2) **Active** — in-progress tournaments, drill in to
**Manage Tournament** — 3) **Scoreboard** — Overall, cross-tournament
ranking — 4) **History** — by-match and by-tournament lists, the latter
drilling into a **per-tournament Scoreboard** — 5) **Member** — add +
list the player pool.

**Confirmed decisions/behavior changes (this session):**
- **No more mid-tournament "add participant."** Participants are chosen
  once, in the Create-tournament checklist, and that roster is fixed for
  the tournament's life. `ParticipantsSection.tsx`'s add-existing/
  create-and-add UI and `useCreatePlayerAndAddParticipant.ts` are
  **deleted**, not just unused.
- **First match still auto-drawn + confirmation popup** on tournament
  creation (kept from the previous draft) — but on confirm, the organizer
  lands **directly on that tournament's Manage screen**, not an "Active"
  list; the tournament simply also appears in the Active tab's list via
  the usual query invalidation. Every match after the first requires an
  explicit, manual **Randomize** tap in Manage Tournament — no more
  auto-drawing subsequent matches.
- **No fixed round count.** Active tournament cards and Manage
  Tournament show "Round N" (current count) only — no "Round N of M", no
  fractional progress bar.
- **Photos are always a generated placeholder avatar** (initials + a
  color derived from the name) — no upload capability, no new `players`
  column, no Supabase Storage bucket this phase.
- **The old in-progress "Standings" (games-won/point-diff) view is gone.**
  Replaced everywhere by one **win-rate-based Tournament Scoreboard**
  (per `SPEC.md` §7) that works identically for an active or ended
  tournament. `StandingsTable.tsx`, `useStandings.ts`, `sortStandings.ts`,
  and `getStandings()` are **deleted**, superseded by the scoreboard
  pieces built in this phase (which reuse the `tournament_standings`
  view's win-rate columns instead).
- **Confirmed results are permanently locked** — no edit path, no admin
  override, anywhere (already true in the current app; this phase just
  keeps it that way deliberately, via a confirm-dialog step before every
  save).
- Selecting participants no longer needs to survive a page navigation
  (it's local state within the single Create-tournament page/component),
  so the previous draft's cross-page `DraftParticipantsContext` is **not
  needed** — a nice simplification versus the prior plan.

1. [ ] **Dependencies + asset groundwork.** `npm install react-router-dom`
   (`^7.18.2`, compatible with installed `react@^18.3.1`). `git mv Material
   src/assets/icons` (Vite can't import from outside `src/`) — **12
   files**: gender/type pickers `male.png`, `female.png`,
   `single_badminton.png`, `double_badminton.png`; scoreboard medals
   `scoreboard_winner1.png`, `scoreboard_winner2.png`,
   `scoreboard_winner3.png`; bottom-tab nav icons `create_tournament.png`
   (Create), `active.png` (Active), `overall_scoreboard.png`
   (Scoreboard), `history_by_person.png` (History), `member.png`
   (Member) — note the nav icons split across two visual styles (3
   single-tone blue-gradient: create/active/history; 2 full-color flat:
   scoreboard/member) that step 22's CSS pass should deliberately
   reconcile or accept, not leave as an oversight. Delete dead
   `src/App.css`. _Test:_ `npm run build` succeeds; `git status` shows
   only the rename + deletion + package files.
2. [ ] **Remove the late-join feature.** Delete
   `src/features/tournaments/ParticipantsSection.tsx` and
   `useCreatePlayerAndAddParticipant.ts`; remove `ParticipantsSection`
   from `TournamentDetail.tsx`'s render (the participants list itself
   moves into the redesigned Manage Tournament in step 19, read-only).
   `useAddParticipant`/`addParticipant` stay — still used internally by
   the creation-time orchestration (step 17). _Test:_ `npm run build &&
   npm run lint` clean; existing `TournamentDetail.test.tsx` cases that
   asserted add-participant behavior are removed/updated accordingly.
3. [ ] **Delete the old in-progress Standings.** Remove
   `src/features/matches/StandingsTable.tsx` (+ its test),
   `useStandings.ts`, `sortStandings.ts` (+ its test), and `getStandings`
   from `matchesApi.ts` — superseded by the win-rate Scoreboard built in
   steps 11-14. _Test:_ `npm run build` clean (no dangling imports).
4. [ ] **Avatar placeholder utility.** New `src/lib/avatarColor.ts` — a
   pure function deriving a stable color from a name (e.g. hash → hue).
   New `src/components/Avatar.tsx` — renders initials (first letters of
   up to two name words) on that color, fixed size prop. _Test:_
   `avatarColor.test.ts` (same name → same color, reasonable spread
   across names); `Avatar.test.tsx` (renders correct initials).
5. [ ] **Centralize `TournamentType`.** New
   `src/features/tournaments/tournamentType.ts` mirroring
   `src/features/players/playerLevels.ts`. Update `CreateTournamentForm.tsx`
   to import from it. _Test:_ `CreateTournamentForm.test.tsx` passes
   unmodified.
6. [ ] **Reusable `IconChoice` component.** New `src/components/IconChoice.tsx`
   — `<fieldset>`/`<legend>` + visually-hidden native radios, each
   `<label>` wrapping an `<img alt="">` + caption. `.visually-hidden` +
   `.icon-choice*` styles in `src/index.css` using existing theme
   variables. _Test:_ `IconChoice.test.tsx` — group/radio roles, click
   calls `onChange`, `checked`/`disabled` reflect props.
7. [ ] **Wire `IconChoice` for Gender and Tournament Type.** Gender in
   `CreatePlayerForm.tsx` only now (its one remaining call site, since
   step 2 deleted the other). Type in `CreateTournamentForm.tsx`. Update
   both components' tests to click radios instead of `selectOptions`.
   _Test:_ updated tests pass; `npm run lint && npm run build` clean.
8. [ ] **`Modal` component.** New `src/components/Modal.tsx` wrapping
   native `<dialog>` — `open`/`onClose` props, `showModal()`/`close()`
   via `useEffect`, `cancel`/`close` listeners for Esc/backdrop. No
   external dependency. _Test:_ `Modal.test.tsx` — content presence,
   `onClose` fires from a close button (assert behavior, not native
   `dialog.open` state — jsdom support is inconsistent).
9. [ ] **Router shell + bottom tab bar.** Wrap `<App/>` in
   `<BrowserRouter>` (`src/main.tsx`). New `src/components/AppLayout.tsx`
   — a bottom-fixed tab bar (Create/Active/Scoreboard/History/Member,
   `NavLink`s) + `<Outlet/>` above it; existing `LanguageToggle` moves
   into a small header or the Member tab (pick one, not both — a nav bar
   with 5 tabs plus a language toggle needs a deliberate spot, decide
   during step 20's CSS pass). Add `nav.create`/`nav.active`/
   `nav.scoreboard`/`nav.history`/`nav.member` i18n keys (both
   `en.json`/`th.json`). Rewrite `App.tsx`: one temporary route (`/`
   under `AppLayout`) rendering a placeholder, to isolate this step's
   diff to routing plumbing. _Test:_ `App.test.tsx` under
   `<MemoryRouter>` — all 5 tab links present with correct text/`href`s.
10. [ ] **Member page.** New `src/pages/MemberPage.tsx` (or
    `src/features/players/MemberPage.tsx`) — heading relabeled to
    "Member"/"Add member" (new i18n keys, `players.form.submit` copy
    updated), `CreatePlayerForm` (now using `IconChoice` for gender, per
    step 7) above `PlayerList.tsx` updated to render `Avatar` + name +
    level per row (no selection checkboxes — selection now lives only in
    Create, step 12). _Test:_ `PlayerList.test.tsx` updated for the
    avatar column; `MemberPage.test.tsx` new, basic render check.
11. [ ] **Win-rate migration.** Extend `tournament_standings` (via
    `apply_migration`) adding `matches_won` and `win_rate` (`NULL` when
    `matches_played = 0`, else `ROUND(matches_won::numeric /
    matches_played::numeric, 4)`) — exact `CREATE OR REPLACE VIEW` SQL
    unchanged from the previous plan iteration (a `match_won` boolean per
    `participant_match_stats` row, `games_won > games_lost`, aggregated).
    Follow with `generate_typescript_types`. _Test:_ `execute_sql` seed
    fixture, hand-verify arithmetic incl. the `NULL` case;
    `get_advisors` spot-check.
12. [ ] **Overall-scoreboard data layer.** New view `player_match_history`
    (one row per player per completed match: `player_id`, `match_id`,
    `tournament_id`, `tournament_type`, `completed_at`, `won boolean`,
    `points_for`) built from the same `team_games_won`-style CTE as
    `tournament_standings`, joined through `tournaments.type`. New
    `listPlayerMatchHistory({ since?, tournamentType? })` in a new
    `src/features/scoreboard/scoreboardApi.ts` (Supabase query with
    optional `.gte('completed_at', ...)`/`.eq('tournament_type', ...)`
    filters — filtering happens at the query level, not by fetching
    everything). New `aggregateScoreboard(rows, players)` pure function
    (mirrors `assembleDrawInputs`'s "fetch raw, compute in JS" pattern) —
    groups by `player_id`, computing `matches_played`, `matches_won`,
    `total_points` (sum of `points_for`), `win_rate`. New
    `useOverallScoreboard(period, type)` hook combining the two. _Test:_
    `aggregateScoreboard.test.ts` — grouping/summing correctness, a
    player with 0 matches in the filtered set is excluded or zeroed
    (decide and assert one behavior), win_rate math.
13. [ ] **Shared `ScoreboardTable` component + medal icons.** New
    `src/features/scoreboard/ScoreboardTable.tsx` — generic ranked table
    (rank incl. medal icons for 0/1/2 via `scoreboard_winner1/2/3.png`,
    `Avatar`, name, matches played/won, a configurable "points" column
    (label + value per row, since Overall shows total points scored but
    per-tournament shows point differential — same component, different
    column config), win rate %). _Test:_ component test — row order,
    medal icons on top 3, correct column values for both a
    "total points" and a "point diff" config.
14. [ ] **Overall Scoreboard page (tab 3).** New
    `src/pages/OverallScoreboardPage.tsx` — two independent filter
    button-groups (Period: All time/This month; Type: All/Singles/
    Doubles, freely combinable), wired to `useOverallScoreboard`,
    rendering `ScoreboardTable` with the "total points" column config.
    _Test:_ selecting a filter combination calls the hook with the right
    args; empty-state when no matches match the filter.
15. [ ] **Per-tournament Scoreboard route.** New
    `src/features/tournaments/TournamentScoreboardRoute.tsx`
    (`/tournaments/:id/scoreboard`) — fetches `tournament_standings` for
    the id (new `getTournamentStandingsRanked` or reuse a trimmed query),
    renders `ScoreboardTable` with the "point diff" column config, sorted
    win_rate desc (`-1` null-sentinel) → point_diff desc → player_id asc
    (new `sortScoreboard.ts`, mirroring the deleted `sortStandings.ts`'s
    shape but for win_rate). No filter bar (tournament itself is the
    scope). _Test:_ `sortScoreboard.test.ts`; route component test
    mocking the query.
16. [ ] **Active tab.** New `src/pages/ActivePage.tsx` — list of
    `status === 'active'` tournaments only, each card: name, type,
    "Round N" (`matches.length` for that tournament, no total/no
    progress bar), tap → `/tournaments/:id`. Empty state: plain "No
    active tournaments" (no apology copy, per `IMPROVEMENT.md`). _Test:_
    card click navigates; empty state renders the exact copy.
17. [ ] **Orchestration mutation + first-match popup.** New
    `src/features/tournaments/useCreateTournamentWithFirstDraw.ts` — same
    design as the previous plan iteration: `createTournament` →
    sequential `addParticipant` per selected id (a mid-loop failure
    throws a `PartialTournamentCreationError` carrying the created
    tournament, for recovery rather than a dead end) →
    `assembleDrawInputs` → `generateNextMatch` → `createMatch(id, 1,
    ...)`. Invalidates `['tournaments']`, `['tournamentParticipants',
    id]`, `['drawInputs', id]`, `['matches', id]`. New
    `FirstMatchDrawnPopup.tsx` built on `Modal`, reusing
    `matches.draw.matchup`-style team-vs-team formatting; "Go to Manage
    Tournament" navigates to `/tournaments/${id}` (not the Active tab).
    The `drawResult.ok === false` branch is unreachable in practice
    (verified against `selectCandidatePool.ts`/`pickDoublesQuartet.ts`/
    `splitIntoTeams.ts` for an exactly-sized, all-zero pool) but still
    handled defensively. _Test:_ hook test — happy path, partial-failure
    path; popup component test — both content branches, button callback.
18. [ ] **Create Tournament page (tab 1).** New
    `src/pages/CreateTournamentPage.tsx` — settings fields (name, type
    via `IconChoice`, games/match, points/game, computed deuce cap) +
    a participant checklist of all members (`Avatar` + name + level per
    row, plain `useState<Set<string>>` local to this page/component — no
    context needed). Submit blocked + inline error
    (`tournaments.form.notEnoughSelected`) when selected count <
    `getNeededPlayerCount(type)`. On valid submit, calls
    `useCreateTournamentWithFirstDraw`; success opens
    `FirstMatchDrawnPopup`. _Test:_ 2 selected + Doubles → error; 4
    selected + Doubles → succeeds, popup shows correct matchup and
    navigates to the tournament's Manage screen on confirm.
19. [ ] **Manage Tournament redesign.** Rewrite
    `src/features/tournaments/TournamentDetail.tsx` (still prop-driven,
    `tournamentId` + optional `onEnded`, no router coupling added
    directly — new `TournamentDetailRoute.tsx` wraps it with
    `useParams`/`useNavigate`, redirecting to
    `/tournaments/:id/scoreboard` via `<Navigate replace>` if already
    `completed`, mirroring the previous plan's router-free-component
    pattern):
    - **Current match card**: empty state ("No match in progress —
      start the next match below") or the two sides with each side's
      name directly above its own score input, and **Save result** →
      opens a `Modal` confirm dialog (review both sides + entered score,
      Cancel/Confirm) before calling `recordMatchResult` — replaces the
      old inline `ResultEntryForm` submit-directly behavior.
    - **Next match card** (new, replaces `DrawSection.tsx`'s combined
      current+queue display): empty ("Not picked yet") until
      **Randomize** is tapped (calls the matchmaking draw, same
      `generateNextMatch` pattern, but only ever fills this "next" slot
      — never auto-promotes). Once populated, a **Start match** button
      appears alongside Randomize; tapping it moves the pairing into
      Current match (resetting score inputs to 0) and clears Next match
      back to empty. This replaces the old "Draw next match" auto-fill /
      auto-promote-on-completion behavior from `useMatchQueue.ts` with
      explicit manual steps — `useMatchQueue.ts` is reworked accordingly
      (current vs. next become two independently-managed pieces of
      state/queries instead of one array).
    - **Rounds played list** (was "Match History" implicitly): completed
      rounds, newest first, round label + both sides ("vs") + winning
      side bold/accented + final score.
    - **End tournament** button, danger-styled, opens a `Modal` confirm
      dialog ("End this tournament? ... you'll be taken to its final
      scoreboard."); on confirm, `endTournament.mutate` then `onEnded?.()`
      → `TournamentDetailRoute` navigates to
      `/tournaments/${id}/scoreboard`.
    - Read-only participants list stays (no add/remove UI — roster is
      fixed per step 2).
    _Test:_ rewritten `TournamentDetail.test.tsx` covering: empty Current
    state; Randomize populates Next only; Start match promotes Next→
    Current and resets Current's inputs; Save result opens the confirm
    dialog and only calls `recordMatchResult` on Confirm, not on the
    initial click; End tournament opens its confirm dialog and only
    calls `endTournament`/`onEnded` on Confirm. New
    `TournamentDetailRoute.test.tsx` for the redirect-when-completed
    case.
20. [ ] **History page.** New `src/pages/HistoryPage.tsx` — two always-
    visible sections. **By match**: new
    `listRecentCompletedMatches()` query (cross-tournament, joins
    `match_participants`/`matches`/`tournaments` for the same "round
    label / vs / winner bold / score" row format as Rounds played,
    newest first). **By tournament**: all tournaments regardless of
    status, each row → `<Link to={`/tournaments/${id}/scoreboard`}>`
    (unconditionally the scoreboard, even for an active tournament — a
    live partial ranking). _Test:_ `HistoryPage.test.tsx` — both
    sections render, by-tournament links target `/scoreboard` regardless
    of status.
21. [ ] **Full route wiring + `vercel.json`.** Final `App.tsx` routes:
    `/` → redirect to `/create` (or make Create the index route
    directly — pick one), `/create`, `/active`, `/tournaments/:id`,
    `/tournaments/:id/scoreboard`, `/scoreboard`, `/history`, `/member`,
    all under `AppLayout`. Add `vercel.json` SPA catch-all rewrite to
    `/index.html` (no local migrations dir precedent for this file —
    it's new, needed so hard refresh/direct links to any nested route
    don't 404 on the existing Vercel deployment). _Test:_ full
    `App.test.tsx` routing smoke test across all 5 tabs; `npm run build`.
22. [ ] **CSS overhaul: bottom-tab mobile-first layout.** Replace
    `src/index.css`'s fixed `1126px` desktop container with a
    mobile-first, always-bottom-tab-bar layout (per the confirmed
    decision — no responsive switch to a top-nav on wide viewports);
    scope down the unscoped 56px `h1` rule; card/list/dialog styling for
    the redesigned Manage Tournament and Scoreboard views; `IconChoice`
    and `Avatar` visual states. Consult the `frontend-design` skill here
    — no exact values prescribed by this phase. _Test:_ Playwright MCP
    check in light/dark `prefers-color-scheme`, at a mobile viewport
    width and a wide one (bottom tab bar present at both); full RTL
    suite green.
23. [ ] **Full regression + walkthrough.** `npm run lint`, `npm run
    build`, `npm test`. Playwright MCP click-through: add a member →
    Create tab, select 2+ from the checklist, submit → confirm popup →
    land on Manage → Randomize + Start match + Save result (confirm
    dialog) for a couple of rounds → End tournament (confirm dialog) →
    land on that tournament's Scoreboard with correct win-rate ranking
    and medal icons → Active tab shows/doesn't show it correctly →
    Scoreboard tab: toggle period/type filters independently and confirm
    the numbers change → History: both sections render, by-tournament
    link reaches the same scoreboard. Both languages, both themes, no
    console errors.
24. [ ] **Deploy + live smoke test.** Push, confirm the Vercel build
    succeeds (watch for the `CLAUDE.md`-documented git-author-email
    deploy-block gotcha from Phase 12), repeat step 23's walkthrough
    against the live URL, including a hard refresh on a nested route to
    confirm the `vercel.json` rewrite works in production.

**Known risks:** the 7 icons are full-color flat illustrations, not a
monochrome set — render as-is in both themes (step 22 judgment call).
`TournamentType`/`MatchType` duplication also exists in
`tournamentsApi.ts` and `src/features/matchmaking/types.ts` — out of
scope here, same as before. A mid-loop participant-add failure in step
17's orchestration leaves a partially enrolled tournament (mitigated,
not eliminated, by the `PartialTournamentCreationError` recovery path).
Step 19 is the single largest, riskiest step in this phase (a full
rework of the current/next/queue model) — consider splitting it further
during implementation if it proves too large for one sitting.

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
