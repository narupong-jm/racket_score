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

## ⚠️ Operational note: integration-test fixture cleanup silently fails — always verify

**Every session that runs the `*.integration.test.ts(x)` suite against the live
Supabase project must manually check for, and delete, leftover fixture data
afterward — do not trust the tests' own `afterAll`/`finally` cleanup blocks to
have actually worked.** This has bitten multiple sessions in a row (most
recently during Phase 20, twice in the same session — see its "Bug found"
note and the follow-up cleanup after it).

**Root cause:** since Phase 16, the `anon` role's direct `DELETE` grant on
`players` is revoked (all real writes go through passphrase-gated RPCs
instead — see Phase 16). Most integration test files' cleanup code still
calls `supabase.from('players').delete(...)` directly against the anon
client, which now fails — but **silently**: Supabase returns no error the
test assertions notice, so the test suite reports green while the fixture
`players` row (and, transitively, anything that still points at it) is left
behind in the live database. `tournaments`/`matches`/`match_participants`/
`match_games` deletes in the same cleanup blocks generally *do* still
succeed (their FK-cascade/anon-grant situation differs), which is what makes
this easy to miss — a quick spot-check of tournaments looks clean while
`players` quietly accumulates junk rows across every test run.

**Why a single regex-based cleanup pass isn't reliable either:** fixture
player names vary by test file (`"Cutover Test Player ${runId}"`,
`"Manually Adjusted A ${runId}"`, `"Draw Inputs Test A ${runId}"`, etc.) and
don't all share an obvious common substring like `"test"` — a pattern that
looks thorough (e.g. `name ~* 'test|cutover|liveness|fixture'`) can still
miss a whole file's fixtures (e.g. `matchesApi.integration.test.ts`'s
`"Manually Adjusted A/B ${runId}"` players, which contain none of those
words) and still report "0 leftover" on its own narrower recheck query.

**What to actually do, every time integration tests run (not just once at
the end of a session):**

1. After any `*.integration.test.ts(x)` run, query `select count(*) from
   players` (and compare against what you'd expect from real club members)
   rather than trusting the test output alone.
2. If checking by name pattern, build the pattern from the actual fixture
   name prefixes used across **every** integration test file in
   `src/features/**/*.integration.test.ts(x)` at that time (grep for
   `` `${runId}` `` / template-literal name prefixes) — don't reuse a
   pattern written for a previous session's fixture set without re-deriving
   it, and don't stop after one cleanup pass without re-querying the full
   player count to confirm nothing was missed.
3. Prefer deleting via the Supabase MCP `execute_sql` tool (service-role
   connection, not subject to the same anon grant restriction) rather than
   trying to fix it through the app.
4. The longer-term fix — updating every integration test's cleanup to
   delete via an RPC (or documenting that `players` fixture rows are
   permanently orphaned by design and must be cleaned up out-of-band) — has
   not been done as of Phase 20 and is a reasonable candidate for a future
   phase, since this has now caused repeat manual cleanup work across
   multiple sessions.

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

1. [x] **Dependencies + asset groundwork.** `npm install react-router-dom`
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
2. [x] **Remove the late-join feature.** Delete
   `src/features/tournaments/ParticipantsSection.tsx` and
   `useCreatePlayerAndAddParticipant.ts`; remove `ParticipantsSection`
   from `TournamentDetail.tsx`'s render (the participants list itself
   moves into the redesigned Manage Tournament in step 19, read-only).
   `useAddParticipant`/`addParticipant` stay — still used internally by
   the creation-time orchestration (step 17). _Test:_ `npm run build &&
   npm run lint` clean; existing `TournamentDetail.test.tsx` cases that
   asserted add-participant behavior are removed/updated accordingly.
3. [x] **Delete the old in-progress Standings.** Remove
   `src/features/matches/StandingsTable.tsx` (+ its test),
   `useStandings.ts`, `sortStandings.ts` (+ its test), and `getStandings`
   from `matchesApi.ts` — superseded by the win-rate Scoreboard built in
   steps 11-14. _Test:_ `npm run build` clean (no dangling imports).
4. [x] **Avatar placeholder utility.** New `src/lib/avatarColor.ts` — a
   pure function deriving a stable color from a name (e.g. hash → hue).
   New `src/components/Avatar.tsx` — renders initials (first letters of
   up to two name words) on that color, fixed size prop. _Test:_
   `avatarColor.test.ts` (same name → same color, reasonable spread
   across names); `Avatar.test.tsx` (renders correct initials).
5. [x] **Centralize `TournamentType`.** New
   `src/features/tournaments/tournamentType.ts` mirroring
   `src/features/players/playerLevels.ts`. Update `CreateTournamentForm.tsx`
   to import from it. _Test:_ `CreateTournamentForm.test.tsx` passes
   unmodified.
6. [x] **Reusable `IconChoice` component.** New `src/components/IconChoice.tsx`
   — `<fieldset>`/`<legend>` + visually-hidden native radios, each
   `<label>` wrapping an `<img alt="">` + caption. `.visually-hidden` +
   `.icon-choice*` styles in `src/index.css` using existing theme
   variables. _Test:_ `IconChoice.test.tsx` — group/radio roles, click
   calls `onChange`, `checked`/`disabled` reflect props.
7. [x] **Wire `IconChoice` for Gender and Tournament Type.** Gender in
   `CreatePlayerForm.tsx` only now (its one remaining call site, since
   step 2 deleted the other). Type in `CreateTournamentForm.tsx`. Update
   both components' tests to click radios instead of `selectOptions`.
   _Test:_ updated tests pass; `npm run lint && npm run build` clean.
8. [x] **`Modal` component.** New `src/components/Modal.tsx` wrapping
   native `<dialog>` — `open`/`onClose` props, `showModal()`/`close()`
   via `useEffect`, `cancel`/`close` listeners for Esc/backdrop. No
   external dependency. _Test:_ `Modal.test.tsx` — content presence,
   `onClose` fires from a close button (assert behavior, not native
   `dialog.open` state — jsdom support is inconsistent).
9. [x] **Router shell + bottom tab bar.** Wrap `<App/>` in
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
10. [x] **Member page.** New `src/pages/MemberPage.tsx` (or
    `src/features/players/MemberPage.tsx`) — heading relabeled to
    "Member"/"Add member" (new i18n keys, `players.form.submit` copy
    updated), `CreatePlayerForm` (now using `IconChoice` for gender, per
    step 7) above `PlayerList.tsx` updated to render `Avatar` + name +
    level per row (no selection checkboxes — selection now lives only in
    Create, step 12). _Test:_ `PlayerList.test.tsx` updated for the
    avatar column; `MemberPage.test.tsx` new, basic render check.
11. [x] **Win-rate migration.** Extend `tournament_standings` (via
    `apply_migration`) adding `matches_won` and `win_rate` (`NULL` when
    `matches_played = 0`, else `ROUND(matches_won::numeric /
    matches_played::numeric, 4)`) — exact `CREATE OR REPLACE VIEW` SQL
    unchanged from the previous plan iteration (a `match_won` boolean per
    `participant_match_stats` row, `games_won > games_lost`, aggregated).
    Follow with `generate_typescript_types`. _Test:_ `execute_sql` seed
    fixture, hand-verify arithmetic incl. the `NULL` case;
    `get_advisors` spot-check.
12. [x] **Overall-scoreboard data layer.** New view `player_match_history`
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
13. [x] **Shared `ScoreboardTable` component + medal icons.** New
    `src/features/scoreboard/ScoreboardTable.tsx` — generic ranked table
    (rank incl. medal icons for 0/1/2 via `scoreboard_winner1/2/3.png`,
    `Avatar`, name, matches played/won, a configurable "points" column
    (label + value per row, since Overall shows total points scored but
    per-tournament shows point differential — same component, different
    column config), win rate %). _Test:_ component test — row order,
    medal icons on top 3, correct column values for both a
    "total points" and a "point diff" config.
14. [x] **Overall Scoreboard page (tab 3).** New
    `src/pages/OverallScoreboardPage.tsx` — two independent filter
    button-groups (Period: All time/This month; Type: All/Singles/
    Doubles, freely combinable), wired to `useOverallScoreboard`,
    rendering `ScoreboardTable` with the "total points" column config.
    _Test:_ selecting a filter combination calls the hook with the right
    args; empty-state when no matches match the filter.
15. [x] **Per-tournament Scoreboard route.** New
    `src/features/tournaments/TournamentScoreboardRoute.tsx`
    (`/tournaments/:id/scoreboard`) — fetches `tournament_standings` for
    the id (new `getTournamentStandingsRanked` or reuse a trimmed query),
    renders `ScoreboardTable` with the "point diff" column config, sorted
    win_rate desc (`-1` null-sentinel) → point_diff desc → player_id asc
    (new `sortScoreboard.ts`, mirroring the deleted `sortStandings.ts`'s
    shape but for win_rate). No filter bar (tournament itself is the
    scope). _Test:_ `sortScoreboard.test.ts`; route component test
    mocking the query.
16. [x] **Active tab.** New `src/pages/ActivePage.tsx` — list of
    `status === 'active'` tournaments only, each card: name, type,
    "Round N" (`matches.length` for that tournament, no total/no
    progress bar), tap → `/tournaments/:id`. Empty state: plain "No
    active tournaments" (no apology copy, per `IMPROVEMENT.md`). _Test:_
    card click navigates; empty state renders the exact copy.
17. [x] **Orchestration mutation + first-match popup.** New
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
18. [x] **Create Tournament page (tab 1).** New
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
19. [x] **Manage Tournament redesign.** Rewrite
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
20. [x] **History page.** New `src/pages/HistoryPage.tsx` — two always-
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
21. [x] **Full route wiring + `vercel.json`.** Final `App.tsx` routes:
    `/` → redirect to `/create` (or make Create the index route
    directly — pick one), `/create`, `/active`, `/tournaments/:id`,
    `/tournaments/:id/scoreboard`, `/scoreboard`, `/history`, `/member`,
    all under `AppLayout`. Add `vercel.json` SPA catch-all rewrite to
    `/index.html` (no local migrations dir precedent for this file —
    it's new, needed so hard refresh/direct links to any nested route
    don't 404 on the existing Vercel deployment). _Test:_ full
    `App.test.tsx` routing smoke test across all 5 tabs; `npm run build`.
22. [x] **CSS overhaul: bottom-tab mobile-first layout.** Replace
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
23. [x] **Full regression + walkthrough.** `npm run lint`, `npm run
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
24. [x] **Deploy + live smoke test.** Push, confirm the Vercel build
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

## Phase 14 — IMPROVEMENT2 Patch (Matchmaking Corrections, Manual Draw Edit, History Collapse)

A narrower patch on the shipped Phase 13 app, based on post-launch hands-on testing
feedback (`docs/IMPROVEMENT2.md`), not another nav/flow overhaul. `docs/SPEC.md` §5/§6/§9
and this file's domain-model notes were already revised to describe the corrected target
behavior before this phase's implementation.

**Confirmed decisions (this session):**
- Doubles quartet selection and team-split both promote gender balance to a **hard
  filter above skill balance** (previously a tiebreak).
- Equal-match-count fairness becomes a **hard invariant** (max − min ≤ 1 after every
  match), enforced via a new `mandatoryIds` concept in `selectCandidatePool`.
- Manual draw editing **warns but does not block** on a gender-balance violation, and is
  flagged in the DB (`matches.manually_adjusted`) and shown in History.
- The first-match popup's `createMatch()` persistence is **deferred until Confirm**,
  matching the Next-match card's model, rather than persisting immediately and adding a
  separate update-on-edit path.
- History's collapsed state shows heading + toggle only (no item peek), default
  collapsed, each section independent.

1. [x] **Equal-match-count hard invariant.** `selectCandidatePool.ts` returns a new
   `mandatoryIds: Set<string>` alongside `pool`; `pickSinglesPair.ts`/
   `pickDoublesQuartet.ts` take an optional `mandatoryIds` param and filter candidate
   combinations to those containing every mandatory id before applying skill/gender
   criteria; `generateNextMatch.ts` threads it through. _Test:_ updated
   `selectCandidatePool.test.ts` cases plus a new tier-expansion-shortfall case; new
   mandatory-filtering cases in `pickDoublesQuartet.test.ts`/`pickSinglesPair.test.ts`;
   a new multi-round invariant-simulation test asserting max−min ≤ 1 after every match.
2. [x] **Mixed-doubles hard filter.** Reorder `pickDoublesQuartet.ts` (gender-imbalance
   filter before skill-spread filter) and `splitIntoTeams.ts` (non-mixed-team-count
   filter before skill-sum-diff filter). _Test:_ replace each file's "skill wins over
   gender" test with a "gender wins over skill" test; confirm existing tiebreak tests
   still pass.
3. [x] **Current-match draw exclusion.** Thread `currentMatchParticipantIds` into
   `NextMatchCard` (`TournamentDetail.tsx`); `handleRandomize` filters them out of
   `drawInputs.candidates` before calling `generateNextMatch`, falling back to the
   unfiltered pool (with a UI warning) only if too few players remain. _Test:_ extend
   `TournamentDetail.test.tsx` for both the exclusion and fallback-with-warning cases.
4. [x] **History collapsible sections.** `ByMatchSection`/`ByTournamentSection` in
   `HistoryPage.tsx` each get independent `useState` collapse state (default collapsed,
   heading-only when collapsed), a new `.section-heading-row`/toggle-button CSS pattern,
   and `history.showMore`/`showLess` i18n keys. _Test:_ default-collapsed, toggle
   expand/collapse, and independence-of-the-two-sections cases in
   `HistoryPage.test.tsx`.
5. [x] **`manually_adjusted` migration.** Via Supabase MCP: add
   `matches.manually_adjusted boolean not null default false`; extend the `create_match`
   function with `p_manually_adjusted`; regenerate `database.types.ts`; `get_advisors`
   check. `matchesApi.ts`'s `createMatch` gains a `manuallyAdjusted` param. _Test:_ real
   anon-key integration test exercises the new param/column.
6. [x] **Shared gender-violation helper.** New pure function (e.g.
   `isMixedDoublesRuleViolated`) in `src/features/matchmaking/`, reusing
   `splitIntoTeams.ts`'s gender-imbalance logic, for both edit surfaces below to call.
   _Test:_ unit tests mirroring `splitIntoTeams.test.ts`'s gender fixtures.
7. [x] **Next-match card inline edit.** Add an Edit action to `NextMatchCard`: tap a
   drawn player, pick a replacement from the roster; tracks `manuallyAdjusted`, shows the
   non-blocking warning via step 6's helper (doubles only), and passes the flag through
   `handleStartMatch` → `startNextMatch` → `createMatch`. _Test:_ extend
   `TournamentDetail.test.tsx` for swap, warning show/hide, and flag propagation.
8. [x] **First-match popup: deferred persistence + inline edit.** Restructure
   `useCreateTournamentWithFirstDraw.ts` to stop calling `createMatch` during
   tournament/participant creation; it now returns the draft draw + roster candidates.
   `FirstMatchDrawnPopup.tsx` gets the same inline-edit/warning affordance as step 7. A
   new confirm mutation calls `createMatch` (with `manuallyAdjusted`) on the popup's
   Confirm click; only then does the app navigate to Manage Tournament. _Test:_ update
   the orchestration hook's existing tests (persistence moves out), add tests for the new
   confirm mutation and the popup's edit/warning behavior.
9. [x] **History: manually-adjusted badge.** `listRecentCompletedMatches` selects
   `manually_adjusted`; `ByMatchSection` renders a badge for flagged rows via a new
   `history.manuallyAdjustedBadge` key. _Test:_ extend `HistoryPage.test.tsx` for the
   badge's presence/absence.
10. [x] **Full regression + walkthrough.** `npm run lint`, `npm run build`, `npm test`.
    Playwright MCP click-through covering all of §1-§3 in one pass (create a tournament →
    edit the first-match popup's lineup, see the warning if made non-mixed → Confirm →
    land on Manage → Randomize Next match with someone currently on court playing, verify
    exclusion or the fallback warning if the pool is tight → Edit the Next match → Start
    → Save result → History tab: both sections collapsed by default, toggle
    independently, manually-adjusted rows show their badge), both languages, both
    themes, no console errors.

**Known risks:** step 8 is the riskiest step in this phase — it restructures an
already-shipped, already-tested orchestration mutation (`useCreateTournamentWithFirstDraw`,
flagged as a "known risk" area back in Phase 13 too) to defer persistence; regression-test
it thoroughly against the existing partial-creation-failure path
(`PartialTournamentCreationError`) before moving on. The hard equal-match-count invariant
(step 1) assumes at most two distinct match-count tiers can coexist when the invariant is
maintained continuously from tournament start — the `mandatoryIds` implementation is
written to degrade safely (never excludes a lower-count player) even if that assumption is
ever violated, but this should be called out if a future bug report suggests otherwise.

## Phase 15 — Cancel Tournament

A narrow, spec-driven addition (`docs/SPEC.md` §4/§9, updated 2026-08-02): a permanent
"discard a mistaken tournament" action, distinct from End Tournament, available only up
until a tournament's first match result is confirmed. No schema/type migration is needed
for the new status value itself (`tournaments.status` is untyped `string`), but a new
atomic RPC is needed to safely delete a drawn-but-unconfirmed match alongside the status
flip.

**Confirmed decisions (this session):**
- Cancel is gated on `completedMatches.length === 0` for the tournament; once any result
  is confirmed, Cancel disappears forever and End Tournament takes its place — the two
  actions are mutually exclusive within the same `danger-zone` block.
- Implemented as a single atomic Postgres RPC, `cancel_tournament(p_tournament_id uuid)
  returns tournaments`, applied via the Supabase MCP connector (no local migration
  convention exists in this repo) — mirroring `create_match`/`record_match_result` rather
  than sequential `.update()`/`.delete()` calls, per `CLAUDE.md`'s atomic-RPC guidance.
  The RPC re-validates its precondition server-side (raises unless the tournament is
  `active` **and** has zero completed matches) since RLS is permissive `anon` and the
  button-visibility gate alone isn't trustworthy.
- No new `cancelled_at` column — `ended_at` stays `null` for cancelled tournaments;
  nothing in the spec displays a cancellation timestamp.
- New i18n keys are distinctly named (`manage.cancelTournament`, `confirmCancelTitle`,
  `confirmCancelBody`, `confirmCancelButton`, `tournamentStatus.cancelled`) — none of
  them reuse `manage.cancel`, which stays the generic modal-dismiss label already shared
  by other confirm dialogs (including the new Cancel dialog's own dismiss button, exactly
  as End's dialog already does).
- History's `ByTournamentSection` only changes behavior for `status === 'cancelled'` rows
  (plain text + `.badge`, no `Link`); active/completed rows are untouched, since no
  Active/Completed badges exist today despite SPEC.md's "in place of Active/Completed"
  phrasing.

1. [x] **`cancel_tournament` RPC.** Via the Supabase MCP connector's `apply_migration`:
   create `cancel_tournament(p_tournament_id uuid) returns tournaments` — raises an
   exception unless the target tournament's `status = 'active'` and it has zero rows in
   `matches` with `status = 'completed'`; deletes `match_participants` then `matches` for
   any row with `status = 'queued'` on that tournament (0 or 1 rows, by the single-court
   model); updates `tournaments.status = 'cancelled'`; returns the updated row. `grant
   execute on function cancel_tournament(uuid) to anon`. Follow with
   `generate_typescript_types` (`src/lib/database.types.ts` — the `Functions` section
   needs the new signature for `supabase.rpc('cancel_tournament', ...)` to type-check,
   same as `create_match`/`record_match_result`) and a `get_advisors` spot-check.
   _Test:_ `execute_sql` seeds a tournament + queued match + its participants, calls the
   function directly, and asserts the `matches`/`match_participants` rows are gone,
   `tournaments.status` is `'cancelled'`, and `player_stats`/`tournament_standings` are
   unaffected (confirming the deliberate never-touches-scoreboard-data invariant);
   a second `execute_sql` case seeds a *completed* match on another tournament and
   asserts the function raises.
2. [x] **`cancelTournament` API wrapper.** New `cancelTournament(tournamentId): Promise<Tournament>`
   in `src/features/tournaments/tournamentsApi.ts`, wrapping `supabase.rpc('cancel_tournament',
   { p_tournament_id: tournamentId })`, mirroring `endTournament`'s shape/error-throwing.
   _Test:_ new case in `tournamentsApi.integration.test.ts` mirroring the existing "ends a
   tournament" test (`cancelTournament(id)` → `status` is `'cancelled'`, `ended_at` still
   `null`); a second case creates a match via `createMatch`/`recordMatchResult` first and
   asserts `cancelTournament(id)` `rejects.toThrow()` — proving the server-side guard
   holds even when called directly, bypassing the UI's button gating entirely.
3. [x] **`useCancelTournament` hook.** New `src/features/tournaments/useCancelTournament.ts`,
   a `useMutation` mirroring `useEndTournament.ts`'s structure, but its `onSuccess`
   invalidates both `['tournaments']` and `['matches', tournamentId]` — needed because,
   unlike `endTournament`, cancelling can delete a cached `matches` row via the RPC, and
   `useTournamentMatches`'s cache for that tournament would otherwise go stale.
   _Test:_ a small hook test asserting both query keys are invalidated on success.
4. [x] **Narrow End Tournament's visibility.** In `TournamentDetail.tsx`, derive
   `hasConfirmedResult = completedMatches.length > 0` and change the existing danger-zone
   guard from `{isActive && (...)}` to gate the End button+modal on
   `isActive && hasConfirmedResult`. Update the two now-affected cases in
   `TournamentDetail.test.tsx`'s "End tournament confirm dialog" describe block — both
   currently mock `listMatches` to `[]` and expect the End button to render — so each
   mocks at least one completed match instead. _Test:_ the two updated RTL cases above,
   plus a new case asserting End tournament is **absent** for an active tournament with
   zero completed matches.
5. [x] **Cancel Tournament button + confirm dialog.** In `TournamentDetail.tsx`'s single
   `danger-zone` block, branch on `hasConfirmedResult`: render the End button+`Modal`
   (step 4) when true, else a new Cancel button+`Modal` using `manage.cancelTournament`,
   `manage.confirmCancelTitle`, `manage.confirmCancelBody`, `manage.confirmCancelButton`
   (new keys in both `en.json`/`th.json`), with the modal's dismiss button reusing
   `manage.cancel` exactly like End's does. New `cancelModalOpen` state, a
   `handleConfirmCancel` calling `useCancelTournament()`'s mutate with
   `onSuccess: () => { setCancelModalOpen(false); onCancelled?.() }`. Extend
   `TournamentDetailProps` with `onCancelled?: () => void`; wire it in
   `TournamentDetailRoute.tsx` as `onCancelled={() => navigate('/active')}`. _Test:_ a new
   "Cancel tournament confirm dialog" describe block in `TournamentDetail.test.tsx`
   mirroring the End block's 3-test shape: (a) Cancel button visible + enabled when
   active with zero completed matches, (b) Cancel button absent once a completed match
   exists (and absent for a non-active tournament), (c) full click-through — dialog opens,
   `cancelTournament` not yet called, confirm click calls it with the right id and then
   fires `onCancelled`.
6. [x] **History: Cancelled badge, non-interactive row.** Add `tournamentStatus.cancelled`
   (`"Cancelled"` / Thai equivalent) to both i18n files — this also fixes
   `TournamentDetail.tsx`'s own header (`tournaments.detail.summary`, which already does
   `t(\`tournamentStatus.${tournament.status}\`)`) for free, no extra wiring needed. In
   `HistoryPage.tsx`'s `ByTournamentSection`, render rows with
   `tournament.status === 'cancelled'` as plain text (name + a `.badge` showing
   `tournamentStatus.cancelled`, no `Link`, no href) instead of the existing
   `<Link to=".../scoreboard">`; active/completed rows keep their current unbadged `Link`
   rendering unchanged. _Test:_ new case(s) in `HistoryPage.test.tsx`: a
   cancelled-tournament fixture renders its name + the Cancelled badge with no accessible
   `link` role for that row, while the existing row-linking test (which only fixtures
   active/completed) continues to pass unmodified.
7. [x] **Full regression + walkthrough.** `npm run lint`, `npm run build`, `npm test`.
   Playwright MCP click-through: create a tournament → in Manage, confirm Cancel
   tournament is visible and End tournament is not → open the confirm dialog, dismiss it
   (nothing happens) → confirm it for real → land on the Active tab with the tournament
   gone → History tab: it appears in By tournament with a Cancelled badge and is not
   tappable into a scoreboard → separately, create a second tournament, play and confirm
   one result, then verify Cancel has disappeared and End has taken its place, and that
   End still works as before (regression). Both languages, both themes, no console
   errors.

**Known risks:** RLS is permissive `anon`, so the RPC's server-side re-check (status
`active` + zero completed matches) is the only real enforcement against a stale or
directly-called cancel; a race where a result is confirmed in one tab while cancel is
submitted from another isn't covered by any UI-level test, only the RPC integration test
in step 2. Step 4's narrowing of End Tournament's visibility silently breaks two existing
passing `TournamentDetail.test.tsx` cases if their fixtures aren't updated in the same
step — easy to miss in review since the tests would otherwise look untouched. No app code
has ever deleted a `matches`/`match_participants` row outside test-cleanup blocks before
this RPC; double-check FK/delete ordering directly against the live schema (`list_tables`)
rather than assuming the test-cleanup convention is authoritative. If a future caller of
`<TournamentDetail>` ever omits `onCancelled`, a stale ephemeral "Next match" draw could
remain visible after a cancel with no navigation to clear it — low risk today since
`TournamentDetailRoute` is the only caller and always wires it.

## Phase 16 — Write-Access Passphrase

A narrow, spec-driven addition (`docs/SPEC.md` §2, updated 2026-08-02): a single
shared passphrase, required before any write (create/update/delete anywhere in the
app), enforced at the database level via RPC — not a UI-only check. Reading/browsing
stays open to everyone, unchanged. This phase converts every remaining direct-table
write (`players` insert/update, `tournaments` insert/update, `tournament_participants`
insert) to go through a passphrase-checked RPC, and adds the same check to the RPCs
that already exist (`create_match`, `record_match_result`, `cancel_tournament`).

**Confirmed decisions (this session, via user interview):**
- One passphrase for the whole app — not per-tournament, not per-person.
- Enforced server-side: every write RPC re-validates the passphrase itself (no
  "trust the client already checked" shortcut); the underlying tables have
  `INSERT`/`UPDATE`/`DELETE` revoked from `anon` so a write is impossible except
  through one of these RPCs.
- Secret is stored **hashed** (via `pgcrypto`) in a new singleton settings table,
  seeded once by migration. No in-app Settings UI to change it — changing it later
  means writing and running a new migration. The actual passphrase text is **not**
  written into this plan or committed anywhere in the repo in plaintext — it's
  supplied by the user directly when the seeding migration is applied.
- No app-entry gate. Browsing every tab works with no prompt. The **first**
  write-triggering action in a browser session pops a passphrase modal; a correct
  entry completes that action and is cached in `sessionStorage` (cleared when the
  tab/browser closes, never longer) so later writes in the same session aren't
  re-prompted — though each is still independently re-checked server-side, so a
  stale/invalidated cached value is caught and re-prompted for.
- Wrong entry: inline error in the modal, unlimited retries, no lockout/rate-limit.
- Applies uniformly to every write path, present and future — any write added later
  must go through the same RPC-plus-passphrase pattern, not a direct table call.

1. [x] **Migration: passphrase settings table + verify RPC.** Via the Supabase MCP
   connector's `apply_migration`: confirmed `pgcrypto` already enabled (schema
   `extensions`, from an earlier phase — no action needed); created singleton table
   `app_secrets (id boolean primary key default true check (id), passphrase_hash
   text not null)`, RLS enabled with **no policies** (so it's reachable only through
   `SECURITY DEFINER` functions owned by a role that bypasses RLS, never directly);
   seeded its one row with `extensions.crypt(<passphrase the user supplied directly
   in chat at this step>, extensions.gen_salt('bf'))` — the raw value was never
   written to this plan, a commit, or any repo file, only pasted into the migration
   SQL sent straight to Supabase. Added internal `plpgsql` helper
   `check_write_passphrase(p_passphrase text)` that raises `EXCEPTION
   'invalid_passphrase'` (`ERRCODE 'P0001'`) unless `p_passphrase` matches the
   stored hash, and public wrapper `verify_write_passphrase(p_passphrase text)
   returns boolean` for the modal's own validation call (step 7).
   **Gotcha found here:** Supabase auto-grants `EXECUTE` to `anon`/`authenticated`
   directly (not via the `PUBLIC` pseudo-role) on every new function in the `public`
   schema at creation time — `revoke all on function ... from public` does **not**
   touch those explicit grants. Needed a second, explicit `revoke execute ...
   from anon, authenticated` pass (on `check_write_passphrase`, which should never
   be callable directly) and `revoke execute ... from authenticated` on
   `verify_write_passphrase` (this app only ever uses the `anon` key). Confirmed
   via `pg_proc.proacl` that the final grants are exactly: `check_write_passphrase`
   → `postgres, service_role` only; `verify_write_passphrase` → `postgres, anon,
   service_role`. Keep this in mind for steps 2-3's new RPCs — they must be
   `anon`-executable (that's the whole point), so no extra revoke needed there, but
   any future *internal-only* helper needs the same explicit anon/authenticated
   revoke, not just a `from public` one. _Test:_ `execute_sql` — correct passphrase
   → `verify_write_passphrase` returns `true`; wrong passphrase → raises
   `invalid_passphrase`, `app_secrets` unchanged; confirmed exactly one row, and its
   `passphrase_hash` is a proper bcrypt hash (`$2...`, 60 chars — not
   plaintext-recoverable by inspection); `get_advisors` (security) shows no new
   `anon_security_definer_function_executable` warning for `check_write_passphrase`
   (the one for `verify_write_passphrase` is expected/intentional — it's the
   client-facing validation entry point).
2. [x] **Migration: passphrase-gate the existing write RPCs.** Dropped and recreated
   `create_match`, `record_match_result`, `cancel_tournament` with a new `p_passphrase
   text` parameter (added before `create_match`'s existing `p_manually_adjusted
   boolean default false` — a defaulted param must be trailing — the other two had no
   defaults so ordering didn't matter); each calls `check_write_passphrase(p_passphrase)`
   as its first statement. **Also switched all three from `SECURITY INVOKER` (their
   prior default) to `SECURITY DEFINER`**, discovered necessary mid-step, not
   anticipated when this step was originally planned: `check_write_passphrase` is
   locked to `postgres`/`service_role` only (step 1), so a still-`SECURITY INVOKER`
   RPC running as `anon` couldn't call it at all. This is also exactly what step 4
   will need anyway — once anon's direct table grants are revoked, these RPCs must
   run with the owner's privileges to still write. Added the required `set
   search_path = public, pg_temp` to all three (mandatory for any `SECURITY DEFINER`
   function, and a bonus fix: `create_match`/`record_match_result` previously had no
   pinned search_path at all, a pre-existing `get_advisors` WARN this incidentally
   resolves). Left anon/authenticated grants at their prior default (unlike step 1's
   internal helper, these three are meant to be directly callable — no extra revoke
   needed; `get_advisors` now flags them as anon/authenticated-executable
   `SECURITY DEFINER` functions, which is expected/intentional here). Regenerating TS
   types is still deferred to step 5, after step 3's new RPCs also land.
   _Test:_ `execute_sql` — each RPC called with the wrong passphrase against a
   nonexistent id raised `invalid_passphrase` before any lookup/mutation ran; full
   round-trip with the right passphrase and real fixture rows (2 players, a
   tournament, `create_match` → `record_match_result` completing it; a second
   tournament, `create_match` → `cancel_tournament` discarding the queued match) via
   `execute_sql` confirmed identical output/side effects to the pre-change behavior,
   including `cancel_tournament`'s pre-existing "already has a confirmed result"
   guard still firing correctly with a *right* passphrase against the first
   tournament; all fixtures cleaned up afterward. `get_advisors` (security)
   re-checked — no unexpected new warnings, only the expected/intentional
   anon-executable-SECURITY-DEFINER ones for these three RPCs (mirroring
   `verify_write_passphrase`'s from step 1).

   **Heads up — live production impact:** this migration was applied directly to the
   live `racket-score` Supabase project (no branch/staging). The currently-deployed
   Vercel app's client code still calls these three RPCs with their *old* argument
   lists (no `p_passphrase`), so **recording a match result and cancelling a
   tournament are broken in production right now** (every call will fail with a
   missing-required-parameter error) until step 8 updates and redeploys the client.
   `create_match` is called internally by the same flows, so drawing a match is
   broken too. Browsing/reading is unaffected. This is an accepted, temporary
   in-between state while working through this phase's steps in order, not a
   regression to fix separately — but don't leave it sitting mid-phase for long
   without telling whoever else might be using the live app.
3. [x] **Migration: new RPCs replacing direct table writes.** Created
   `create_player(p_name text, p_gender text, p_self_selected_level text,
   p_passphrase text) returns players`; `update_player(p_id uuid, p_passphrase
   text, p_name text default null, p_gender text default null,
   p_self_selected_level text default null) returns players` (each nullable field
   left `NULL` means "leave unchanged," via `COALESCE` against the existing row —
   mirrors today's partial-update client call; `p_passphrase` had to be declared
   before the defaulted fields, not after, since Postgres requires all
   defaulted params to trail — harmless, since PostgREST/the JS client always
   calls by name, not position); `create_tournament(p_name text, p_type text,
   p_games_per_match int, p_points_per_game int, p_passphrase text, p_win_by int
   default 2) returns tournaments` (confirmed via `list_tables` that `point_cap`
   is a `GENERATED ALWAYS AS` column, so a plain insert of the other fields
   reproduces the old direct-insert behavior exactly, no cap logic duplicated in
   the RPC); `add_participant(p_tournament_id uuid, p_player_id uuid, p_passphrase
   text) returns tournament_participants`; `end_tournament(p_tournament_id uuid,
   p_passphrase text) returns tournaments` (status → `completed`, `ended_at` →
   `now()`). All five: `check_write_passphrase` first, `security definer` + `set
   search_path = public, pg_temp` (same reasoning as step 2), explicit `grant
   execute ... to anon`; `update_player`/`end_tournament` explicitly
   `raise exception` on a missing id (parity with the old `.select().single()`
   client call, which already errored on 0 rows returned) rather than silently
   returning nothing. No new business-rule validation was added beyond what the
   table's own `CHECK` constraints already enforced — this step is a mechanical
   RPC wrapper around the prior direct-write behavior, not a behavior change.
   _Test:_ `execute_sql` per RPC — wrong passphrase raised `invalid_passphrase`
   against a nonexistent id/bogus row with zero data change for all five; full
   round-trip with the right passphrase and real fixture rows confirmed each
   RPC's output matches the old direct insert/update exactly (`create_player` →
   correct row; `update_player` changing only `self_selected_level` left
   `name`/`gender` untouched, confirming `COALESCE` partial-update parity;
   `create_tournament` → `win_by` defaulted to 2 and `point_cap` auto-computed to
   30 for a 21-point game, matching the BWF formula; `add_participant` → correct
   join row; `end_tournament` → `status`/`ended_at` set correctly); separately
   confirmed `update_player`/`end_tournament` raise a clear "not found" error
   with the *right* passphrase against a nonexistent id (proving the passphrase
   check and the not-found check are independent, not conflated); all fixtures
   cleaned up afterward. `get_advisors` (security) re-checked — only the
   expected/intentional anon-executable-`SECURITY DEFINER` warnings for all five
   new RPCs, no unrelated regressions.
4. [x] **Migration: revoke direct anon writes.** Audited via
   `information_schema.role_table_grants`: `anon` held the full default Supabase
   grant set (`SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`) on
   all six tables, layered under the "permissive anon policies" RLS from Phase 2.8
   (an `anon_full_access` RLS policy per table, `USING (true) WITH CHECK (true)`
   for `ALL` commands — but RLS is beside the point once the underlying `GRANT` is
   gone, since Postgres checks table privileges before RLS is ever evaluated).
   `revoke insert, update, delete, truncate on players, tournaments,
   tournament_participants, matches, match_participants, match_games from anon`;
   `SELECT`/`REFERENCES`/`TRIGGER` left untouched. **Scope note:** the plan
   wording only named `insert, update, delete`, but `TRUNCATE` was added too —
   RLS policies don't apply to `TRUNCATE` at all in Postgres, so leaving that grant
   in place would have left one destructive write completely outside this phase's
   "every write needs the passphrase" goal, even though the Supabase JS client /
   PostgREST has no path that issues a `TRUNCATE` today. `REFERENCES`/`TRIGGER`
   were left alone — DDL-only privileges PostgREST never exposes via the REST API
   regardless of role, so revoking them would be inert except for risking an
   unrelated side effect. _Test:_ real HTTP round-trip against the live project
   using the actual anon (legacy JWT) key, not just `execute_sql`/MCP (which run
   with elevated privileges and would silently mask a grants-only fix): a `POST
   /rest/v1/players` insert attempt returned **`401`, Postgres code `42501`,
   "permission denied for table players"** — a genuine grant-level rejection, not
   an RLS zero-rows response; repeated for all six tables' `INSERT` endpoint, same
   `42501` result every time. A `GET /rest/v1/players?select=id&limit=1` in the
   same session returned `200` with data, confirming reads are untouched. A `POST
   /rest/v1/rpc/create_player` call with the correct passphrase in the same
   session returned `200` and created a real row — proving anon can still write
   through the new RPC path even though direct table writes are now blocked (row
   cleaned up afterward). `get_advisors` (security) re-checked: no new warnings;
   the six pre-existing `rls_policy_always_true` warnings **persist** as expected
   — they're a static read of the still-present `anon_full_access` policy text,
   which the linter has no way to know is now unreachable for
   INSERT/UPDATE/DELETE/TRUNCATE because of the grant revoke sitting in front of
   it. Left as-is rather than rewritten to a SELECT-only policy: rewriting six
   named policies from earlier phases wasn't part of this step's scope, and the
   revoke alone is a complete, independently-sufficient enforcement layer (proven
   by the HTTP test above) — but a future reader of `pg_policies` alone, without
   also checking grants, could be misled into thinking anon can still write to
   these tables. Worth a follow-up cleanup someday, not urgent since it's
   cosmetic/documentation-accuracy risk, not a real access-control gap.
5. [x] **Regenerate TS types.** `generate_typescript_types` → `src/lib/
   database.types.ts`, picking up all of steps 1-3's new/changed `Functions`
   signatures (`add_participant`, `cancel_tournament`, `check_write_passphrase`,
   `create_match`, `create_player`, `create_tournament`, `end_tournament`,
   `record_match_result`, `update_player`, `verify_write_passphrase` all present
   with their new `p_passphrase` args; `app_secrets` also now appears as a
   regular table type, harmless/unused by the app). One transcription slip while
   pasting the generator's output back in — the `CompositeTypes<>` helper's last
   branch got written as `DefaultSchema["CompositeTypes"][CompositeTypeName]`
   instead of the generator's actual `[PublicCompositeTypeNameOrOptions]` —
   caught and fixed before running the build below; harmless in practice since
   `CompositeTypes` is `{[_ in never]: never}` (no composite types exist), but
   worth a mention since it shows manual re-typing of a generated file is a
   real error source, not just a mechanical copy. _Test:_ `npm run build` (via
   `tsc -b`) — exactly 3 errors, all "Property 'p_passphrase' is missing," all
   at the three call sites in `matchesApi.ts`/`tournamentsApi.ts` that already
   call an RPC (`create_match`, `record_match_result`, `cancel_tournament` — step
   2's changes). This confirms the expected split precisely: TypeScript catches
   the RPC call sites because their argument *shape* changed, but it has no way
   to know about step 4's grant revocation, so `playersApi.ts`'s/
   `tournamentsApi.ts`'s remaining direct `.insert()`/`.update()` calls
   (`createPlayer`, `updatePlayer`, `createTournament`, `addParticipant`) still
   type-check cleanly even though they're now runtime-broken in production
   (permission-denied, per step 4's note) — a reminder that this step's clean
   build is necessary but not sufficient evidence of correctness; only step 8's
   actual rewiring (plus the walkthrough in step 9) closes that gap. All 3
   errors resolved in step 8, not here.
6. [x] **Client passphrase cache + gate.** New `src/lib/passphraseStore.ts` —
   `getCachedPassphrase()`/`setCachedPassphrase()`/`clearCachedPassphrase()` thin
   wrappers over `sessionStorage`, plus its own small unit test file (mirroring
   `avatarColor.test.ts`'s convention for a pure `src/lib/` util). New
   `src/features/passphrase/passphraseApi.ts` — `verifyWritePassphrase(passphrase)`
   wrapping `supabase.rpc('verify_write_passphrase', ...)`, throwing on error
   (mirrors every other `*Api.ts` file's `if (error) throw error` convention); since
   the RPC itself always either returns `true` or raises, this wrapper is
   `Promise<void>`, not `Promise<boolean>` — success is "didn't throw."
   Built the provider as **three files, not one**, after `npm run lint` flagged
   `react-refresh/only-export-components` on an initial single-file version that
   exported both the component and the `usePassphraseGate` hook together:
   `PassphraseGateContext.ts` (just the `createContext` call + its value type, no
   JSX), `usePassphraseGate.ts` (the consuming hook, throws if called outside the
   provider), `PassphraseGateProvider.tsx` (the actual provider component). The
   provider's `getPassphrase(): Promise<string>` returns the cached value
   immediately if present; otherwise it opens a modal (state + a
   resolve/reject pair held in a ref, keyed to the one in-flight request) and the
   promise resolves once submission calls `verifyWritePassphrase` successfully
   (caching the value first) or rejects if the modal is dismissed/cancelled
   (closing via the `X`/Esc/backdrop, all already wired through `Modal.tsx`'s
   `onClose` — no separate "cancel" affordance needed). A failed verify shows an
   inline error and leaves the modal open for another attempt, per the "unlimited
   retries" decision. **The modal's actual content right now is a bare, un-i18n'd
   placeholder form** (`PassphrasePrompt`, private to `PassphraseGateProvider.tsx`)
   wrapped in the existing `Modal.tsx` — deliberately not the polished
   `PassphraseModal.tsx` component step 7 is scoped to build; the public contract
   (`getPassphrase()`/`usePassphraseGate()`) won't change when step 7 swaps the
   rendered content, so nothing here is throwaway except that one inner function.
   Mounted `<PassphraseGateProvider>` once in `main.tsx`, wrapping `<App />` inside
   `<BrowserRouter>` — the highest sensible point, so every feature hook added in
   step 8 can call `usePassphraseGate()`. _Test:_ `PassphraseGateProvider.test.tsx`
   — a cached value resolves immediately with no modal rendered and
   `verifyWritePassphrase` never called; no cached value opens the modal, and the
   promise only resolves after a mocked `verifyWritePassphrase` succeeds (asserting
   both the resolved value and that `setCachedPassphrase` was called with it); a
   third case (beyond the plan's original two) — a rejected `verifyWritePassphrase`
   shows the inline error, leaves the modal open, and never calls
   `setCachedPassphrase` or resolves the caller's promise. Hit one real test bug
   while writing these: without `vi.clearAllMocks()` in `beforeEach`, the second
   test's successful call history leaked into the third test's "not called"
   assertion (mock call arrays persist across `it()` blocks by default in Vitest)
   — added the clear, all three pass in isolation and together. Full-suite check:
   `npm run lint` clean, `npm run build` shows the *same* 3 pre-existing
   `p_passphrase`-missing errors as step 5 (no new ones), and `npm test` shows the
   same 16 pre-existing integration-test failures as before this step (all real
   anon-key round-trips hitting steps 2/4's now-incompatible old call shapes,
   exactly the already-flagged production breakage — not a step 6 regression); all
   38 non-integration test files, including the 3 new ones added here, pass.
7. [x] **`PassphraseModal` component.** New `src/components/PassphraseModal.tsx`
   built on the existing `Modal.tsx`, following the exact markup convention already
   used by `TournamentDetail.tsx`'s End/Cancel confirm dialogs (`<h3>` title,
   `<p>` body, a `.field`/`.field-label` wrapped input matching
   `CreatePlayerForm.tsx`'s convention, a `.modal-actions` div with a `secondary`
   Cancel button alongside the primary Submit) rather than inventing new markup
   patterns. Props: `open`, `invalid`, `submitting`, `onSubmit(passphrase)`,
   `onCancel()` — a **controlled/presentational component**, not the one holding
   the async verify logic (that stays in `PassphraseGateProvider`, already built
   and tested in step 6); this keeps the two concerns independently testable, as
   planned. No cancel-and-proceed path: both the `X` close button and the new
   explicit Cancel button route through the same `handleClose` → `onCancel` — there
   is no way to dismiss the modal that doesn't also reject the caller's pending
   `getPassphrase()` promise (`PassphraseGateProvider`'s existing `handleCancel`
   already does the rejection; this step didn't need to touch that). Submit is
   disabled while `submitting` **or** while the field is empty (a small addition
   beyond the plan's literal wording, cheap and consistent with every other form
   in the app disabling submit on invalid/empty input, e.g. `CreatePlayerForm`).
   Added a top-level `passphrase` block to both `en.json`/`th.json`:
   `title`/`prompt`/`label`/`submit`/`cancel`/`invalid` (`cancel` wasn't in the
   plan's original key list — added once the component needed an explicit Cancel
   button to match the app's existing two-button modal-actions convention).
   Replaced `PassphraseGateProvider.tsx`'s step-6 placeholder (`PassphrasePrompt`
   + a raw `Modal` wrapper) with `<PassphraseModal open={isOpen} invalid={invalid}
   submitting={submitting} onSubmit={handleSubmit} onCancel={handleCancel} />` —
   confirmed the swap needed **zero changes** to `PassphraseGateProvider.test.tsx`
   (from step 6), since the label text ("Passphrase") and button text ("Submit")
   happened to already match between the placeholder and the real i18n strings;
   all 3 of that file's tests still pass unmodified against the real component.
   _Test:_ new `PassphraseModal.test.tsx` (7 cases) — submit calls `onSubmit` with
   the typed value; `invalid` renders the inline error via `role="alert"` while
   the field stays visible/usable; both the close (`X`) button and the explicit
   Cancel button call `onCancel` (mirrors `Modal.test.tsx`'s existing
   close-button-click pattern rather than attempting a real Escape/backdrop event,
   since `Modal.tsx`'s own comment already notes jsdom's `<dialog>` support is too
   inconsistent to test those directly); submit disabled while `submitting`; submit
   disabled with an empty field; renders nothing when `open` is `false`. Full-suite
   check: `npm run lint` clean; `npm run build` shows the same 3 pre-existing
   `p_passphrase` errors as steps 5-6 (no new ones); `npm test` shows the same 16
   pre-existing integration-test failures as before (unrelated, already-flagged
   production breakage) — 203 total tests now (up from 196), all 7 new ones from
   this step passing, zero regressions elsewhere.
8. [x] **Wire the client API layer through the gate.** `playersApi.ts`
   (`createPlayer`, `updatePlayer`), `tournamentsApi.ts` (`createTournament`,
   `addParticipant`, `endTournament`, `cancelTournament`), `matchesApi.ts`
   (`createMatch`, `recordMatchResult`) — every function now takes an explicit
   `passphrase: string` parameter and threads it through as `p_passphrase` on its
   RPC call (`createPlayer`/`updatePlayer`/`createTournament`/`addParticipant`/
   `endTournament` switched from a direct `.insert()`/`.update()` to
   `supabase.rpc(...)`, since step 4 revoked anon's direct grants; the other three
   already called an RPC and just gained the parameter). **Design deviation from
   the original wording:** `getPassphrase()` is a *hook* (`useContext` inside),
   so it can't be called from these plain `*Api.ts` async functions directly —
   each mutation hook (`useCreatePlayer`, `useUpdatePlayer`, `useAddParticipant`,
   `useEndTournament`, `useCancelTournament`, `useStartNextMatch`,
   `useRecordMatchResult`, `useCreateTournamentWithFirstDraw`) calls
   `usePassphraseGate()` once at its own top level (a hook calling a hook, valid
   React) and awaits `getPassphrase()` *inside* its `mutationFn` callback,
   passing the resolved value down into the plain API function. This is a
   structural difference from this step's original text (which implied the API
   functions themselves would call the gate) but preserves every behavioral
   guarantee from step 6/7 (cache-or-prompt, one modal per logical action).
   `useCreateTournamentWithFirstDraw` resolves the passphrase **once** and reuses
   it for `createTournament` plus the whole `addParticipant` loop, not once per
   RPC call. **The stale-cache clear-and-retry behavior described in this step's
   original text was not implemented** — deliberately descoped, not missed: it
   depends on a passphrase-rotation feature (an in-app way to invalidate the
   cached value mid-session) that doesn't exist per this phase's confirmed
   decisions (rotation is migration-only, done by editing `app_secrets` directly,
   which can only happen between sessions, not while a tab is open); revisit only
   if that assumption changes.
   **Two pieces of confirmed-dead code found blocking the build, deleted rather
   than updated:** `useCreateTournament.ts` and `CreateTournamentForm.tsx`
   (+ its test) — a pre-Phase-13 tournament-creation form/hook pair with no
   route/page importing it (confirmed via grep: its only importer was its own
   test file), superseded by `CreateTournamentPage.tsx` +
   `useCreateTournamentWithFirstDraw` back in Phase 13. Left alone it would have
   needed passphrase-wiring of its own just to keep compiling, for code nothing
   in the app can ever render — deleted per `CLAUDE.md`'s "if you are certain
   something is unused, delete it completely" convention instead.
   **Real-passphrase test infrastructure:** the real anon-key integration test
   files (`playersApi.integration.test.ts`, `tournamentsApi.integration.test.ts`,
   `matchesApi.integration.test.ts`, `useDrawInputs.integration.test.tsx`,
   `playerLevelCutover.integration.test.ts`, `playerStatsLiveness.integration.test.ts`)
   need the *actual* write passphrase to exercise real RPC round-trips, not a
   mock — but that value must never land in committed source. Added
   `VITE_TEST_WRITE_PASSPHRASE` to the local, gitignored `.env` (alongside the
   existing `VITE_SUPABASE_ANON_KEY` pattern) and an empty placeholder in the
   tracked `.env.example`; new `src/test/testPassphrase.ts` reads it via
   `import.meta.env`, throwing loudly if unset (mirrors
   `supabaseClient.ts`'s existing fail-loud convention) — every integration test
   file imports `testWritePassphrase` from there rather than a literal string.
   For everything else (component/hook unit tests that already mock the
   `*Api.ts` module directly), added `vi.mock('.../usePassphraseGate', () => ({
   usePassphraseGate: () => ({ getPassphrase: vi.fn().mockResolvedValue(
   'test-passphrase') }) }))` per file and updated each exact-call-args
   assertion (`toHaveBeenCalledWith(...)`) to include the new parameter —
   consistent with this codebase's existing convention of mocking the API
   module rather than rendering a real provider tree.
   **`supabaseClient.integration.test.ts` rewritten, not just patched:** its one
   test asserted a direct anon insert *succeeds* ("proving RLS permits anon
   access") -- exactly the behavior step 4 deliberately removed, so the old
   assertion is now false by design. Replaced with two tests: a `SELECT` still
   succeeds, and a direct `INSERT` is rejected with Postgres code `42501` --
   turning step 4's manual `curl` verification into permanent regression
   coverage in the suite, instead of just deleting the now-wrong test.
   _Test:_ `npm run lint` clean; `npm run build` clean (zero errors, first time
   since step 5); full `npm test` run -- **all 45 test files / 201 tests pass**,
   including every real anon-key integration test exercising the actual live
   Supabase project end-to-end through the new RPCs with the real seeded
   passphrase (proving the whole chain -- migration, grants, client, hooks --
   works together, not just in isolation).
9. [x] **Full regression + walkthrough.** `npm run lint` clean, `npm run build`
   clean, `npm test` — 201/201 passing (re-confirmed fresh, no drift since step 8).
   Playwright MCP click-through against the local dev server (`localhost:5173`),
   real anon-key traffic against the live project throughout (no mocks in the
   browser):
   - Every tab (Create, Active, Scoreboard, History, Member) browsed freely with
     no passphrase prompt, in both Thai (the persisted default from prior
     sessions) and English.
   - **Create tournament** (Thai): filled the form, selected 2 real members,
     submitted → passphrase modal appeared with correct Thai copy
     ("กรอกรหัสผ่าน" / "รหัสผ่าน" / "ยืนยัน"). Wrong value → inline error
     ("รหัสผ่านไม่ถูกต้อง ลองใหม่อีกครั้ง"), modal stayed open, field retained.
     Right value → tournament created, first match auto-drawn, popup shown
     ("แมตช์แรก: Fah พบ Jackie").
   - **Cache reuse across write types in the same tab**, no re-prompt for any of:
     confirming the first-match popup (`createMatch`), recording a match result
     via the confirm-result dialog (`recordMatchResult`), adding a new member
     from the Member tab (`createPlayer`) — three structurally different write
     paths, one passphrase entry.
   - **Tab close/reopen → cache cleared → re-prompts**, confirmed by actually
     closing the Playwright-controlled page and opening a fresh one (not just a
     same-tab reload, which does *not* clear `sessionStorage` and correctly did
     *not* re-prompt when tried first) — the very next write (add member) showed
     the passphrase modal again, proving the cache is genuinely session-scoped.
   - **Cancelling the passphrase modal aborts the write**, not just visually:
     opened End Tournament's confirm dialog, triggered the passphrase modal, hit
     its own Cancel button, then verified directly against the database that
     `tournaments.status` was still `active`/`ended_at` still `null` — the
     mutation never ran. Retried immediately with the right passphrase in the
     same modal session → succeeded, navigated to the final Scoreboard with
     correct win-rate/point-diff numbers (Fah 100%/+17, Jackie 0%/-17, matching
     the 21-15/21-10 result entered).
   - **English language**: confirm-dialog and passphrase-modal copy all correctly
     translated ("Enter passphrase" / "This action changes data..." / "Cancel" /
     "Submit"), same cache/re-prompt behavior confirmed independently of locale.
   - **Console**: zero JS/React errors at any point during the actual test
     interactions (checked after every mutating action, not just once at the
     end). One *expected*, unavoidable browser-level entry did appear during the
     deliberate wrong-passphrase test — Chrome's own "Failed to load resource:
     400" network log for the rejected `verify_write_passphrase` call, which
     Chrome logs automatically for any non-2xx response regardless of whether
     the app's own `catch` handles it (which it does) — this is not a bug, an
     unhandled rejection, or something the app can suppress.
   - **Not separately verified**: dark `prefers-color-scheme` rendering — the
     Playwright MCP tools available in this session have no color-scheme
     emulation control, and Phase 16 introduced zero new CSS (the modal reuses
     `Modal.tsx`'s existing dialog styling plus the pre-existing `.field`/
     `.modal-actions` classes already exercised under both themes during
     Phase 13's original CSS pass), so the risk here is low, but it's a real gap
     in this step's coverage worth naming rather than silently claiming "both
     themes" were checked.
   - All test/demo data created during the walkthrough (the tournament, its
     match/games/participants, and the two players added via the Member form)
     was deleted afterward via `execute_sql`; `Fah`/`Jackie` (pre-existing real
     members used as participants) were left untouched.

**Known risks:** the seeded passphrase must never land in a committed file, chat
transcript stored in the repo, or migration checked into version control in
plaintext — only its hash, produced from a value the user provides directly when
step 1 is actually applied. Storing the raw passphrase in `sessionStorage` (not a
hash) is an accepted, deliberate simplification for this low-stakes shared-club-app
threat model, not an oversight — don't "fix" it into a hashed client-side value
without checking with the user first, since the RPC needs the raw value to compare
against `crypt()`. Step 8's clear-and-retry path is the one piece of real new
concurrency complexity — if a user has two tabs open and the passphrase is rotated
between them, the tab with the stale cache should recover via one re-prompt, not an
infinite loop or a silent failure; test this path explicitly rather than trusting
it works by inspection.

## Phase 17 — Post-Phase-16 Patch: Matchmaking Race Fix, Save-Result Lock, Scoreboard Unification

A narrower, post-launch patch found during real hands-on use of the live app (not a
`docs/IMPROVEMENT*.md`-driven phase — surfaced directly in conversation and turned
into `docs/SPEC.md` §5/§6/§7/§8 updates, dated 2026-08-03, before any code changed).
Three independent fixes: (1) a real correctness bug in Current-match exclusion when
combined with the Start-match promotion flow, (2) a new workflow lock requiring the
Next match to be drawn before a Current match's result can be saved, and (3)
unifying the two Scoreboards' columns/ranking and adding frozen header/identity
columns to both.

**Confirmed decisions (this session, via user interview — one question at a time,
per explicit request):**
- An initially-proposed Ranking change (primary sort switched from win-rate to
  total points) was **explicitly withdrawn mid-interview** — win-rate stays the
  **primary** sort criterion everywhere, unchanged from `docs/SPEC.md`'s existing
  wording.
- Final ranking, both Scoreboards identically: **win-rate (desc) → total points
  scored (desc) as tiebreak**, replacing point-differential as the per-tournament
  Scoreboard's old tiebreak. If both are tied, ranks are **not** broken further —
  tied entries share a rank number using standard competition ranking (e.g. two
  players tied for 1st → both show rank 1, the next distinct entry is rank 3, not
  2).
- Per-tournament Scoreboard's new Total Points column is computed by querying the
  existing `player_match_history` view filtered by `tournament_id` (a new optional
  filter added to `listPlayerMatchHistory`) — deliberately **not** a SQL view
  migration, to reuse the exact same underlying metric Overall Scoreboard already
  used, with zero schema change.
- Save-Result lock applies to **every** Current match tournament-wide, regardless
  of whether it was manually adjusted. The bypass ("Is last match" checkbox) does
  **only** one thing — unlocks the Save-result button for that one save. It does
  not draw a match, does not end the tournament, and does not persist anywhere;
  ending the tournament afterward still requires the separate, pre-existing End
  Tournament action.

1. [x] **Bugfix: Current-match exclusion race.** Root cause, found via a dedicated
   subagent trace through `useStartNextMatch`/`TournamentDetail.tsx`: the mutation's
   `onSuccess` called `queryClient.invalidateQueries({ queryKey: ['matches',
   tournamentId] })` without `return`-ing the promise, so TanStack Query didn't
   await the refetch before running the `mutate()`-call-site `onSuccess` (which
   resets the ephemeral Next-match draw state, re-enabling Randomize). A manual
   adjust → Start match → immediate Randomize sequence could therefore draw against
   a stale `['matches', tournamentId]` cache that didn't yet reflect who was
   actually in the just-started Current match, letting that player be drawn right
   back into Next. Fix: `return` the `invalidateQueries` promise in
   `useMatchQueue.ts`'s `useStartNextMatch`; also added a `startNextMatch.isPending`
   guard to the Randomize button (`TournamentDetail.tsx`) as defense-in-depth,
   mirroring the existing guard already on Start match. _Test:_ new
   `src/features/matches/useMatchQueue.test.tsx` — a deliberately-delayed refetch
   proves the mutation does not resolve (and a caller `onSuccess` does not fire)
   until the refetch lands; confirmed this test fails against the pre-fix code
   (reverted the `return` locally, re-ran, saw the expected failure) and passes
   once restored, so the regression coverage is verified, not assumed.
2. [x] **Save-Result lock + "Is last match" checkbox.** The drawn-but-not-started
   Next match was, and remains, ephemeral React state (`nextDraw`) — never
   persisted until Start match. Lifted that state from `NextMatchCard` up to
   `TournamentDetail` (now a controlled prop pair, `nextDraw`/`onNextDrawChange`)
   so `CurrentMatchForm` can read "has a Next match been drawn" and gate its Save
   Result button: `disabled={!isValid || (!hasNextMatchDrawn && !isLastMatch)}`.
   Added the `isLastMatch` checkbox (plain `<input type="checkbox">`-in-`<label>`,
   matching the existing precedent in `CreateTournamentPage.tsx`'s participant
   checklist — no reusable checkbox component existed before this) plus a
   `field-hint` message shown only while locked. New i18n keys `manage.isLastMatch`
   / `manage.saveResultLockedHint` in both `en.json`/`th.json`. _Test:_
   `TournamentDetail.test.tsx` — three new cases covering locked-by-default,
   unlocked-after-Randomize, and unlocked/re-locked via the checkbox; the
   pre-existing "Save result confirm dialog" test updated to check the box first
   (no Next match drawn in that fixture).
3. [x] **Scoreboard column/ranking unification + frozen header/columns.** New
   shared `src/features/scoreboard/rankScoreboard.ts` (sorts win-rate desc → total
   points desc, player-id as a stable-order-only tiebreak that never affects the
   displayed rank number; assigns standard-competition rank numbers) used by both
   `TournamentScoreboardRoute.tsx` and `OverallScoreboardPage.tsx`, replacing the
   now-deleted `sortScoreboard.ts`. `TournamentScoreboardRoute.tsx` now runs a
   second query (`listPlayerMatchHistory({ tournamentId })`, the new filter from
   `scoreboardApi.ts`) alongside the existing `tournament_standings` query and
   merges summed `points_for` per player into each row, replacing `point_diff`.
   `ScoreboardTable.tsx`: `ScoreboardRow` gained a `rank` field (medal icon/number
   keyed off it, not array index, so ties render identically) and lost the
   `pointsColumn` prop (both callers now always show `scoreboard.columnTotalPoints`
   — no more point-diff variant). Frozen header/columns implemented as CSS-only:
   `.scoreboard-table-wrap` became its own bounded scroll box (`overflow: auto;
   max-height: min(70vh, 640px)`, switched from page-level scrolling to avoid
   coordinating a `top` offset against the unrelated sticky `.app-header`);
   `border-collapse: collapse` → `separate` (collapsed borders break `position:
   sticky` cells in some browsers); RANK/PHOTO/NAME cells get `.sticky-col` with
   fixed cumulative `left` offsets (0 / 56px / 120px) matching the now-fixed
   `.rank-col`/`.avatar-col` widths (56px/64px, previously `width: 1%`). _Test:_
   `rankScoreboard.test.ts` (new), `ScoreboardTable.test.tsx` (rank-based
   rendering + a new tied-ranks case), `TournamentScoreboardRoute.test.tsx`
   (mocks both queries, asserts the merged Total Points column), unaffected
   `OverallScoreboardPage.test.tsx` cases still pass unmodified.
4. [x] **`docs/SPEC.md` updated ahead of code.** §5 (exclusion must use the
   Current match's actual, up-to-date — i.e. post-manual-adjustment — roster), §6
   (new Save-Result-lock rule + "Is last match" bypass), §7/§8 (both Scoreboards:
   win-rate → total-points tiebreak, ties share a rank, identical column set,
   frozen header/RANK/PHOTO/NAME columns), plus a new dated "Updated" note at the
   top. Done in a separate pass before any implementation step above, per explicit
   user instruction.
5. [x] **Full regression + live smoke test.** `npx tsc -b`, `npm run lint`,
   `npx vitest run` (46 files / 205 tests, all green) after every step above.
   Dev-server + Chrome walkthrough against the **live Supabase data** (not mocks):
   Overall Scoreboard's tie-aware ranking confirmed visually against real
   duplicate-rank rows; per-tournament Scoreboard for "ตีแบดจนไหล่เบี่ยง ver
   remake!" cross-checked column-for-column against numbers computed by hand
   earlier the same session; horizontal frozen-column behavior confirmed by
   shrinking `.scoreboard-table-wrap` via `javascript_tool` (the browser
   automation's `resize_window` call didn't actually change the rendered
   viewport in this environment — worked around by resizing the element under
   test directly instead). Save-Result lock/checkbox verified live in the Manage
   screen for a real tournament by typing a valid score and toggling the
   checkbox — **did not** click Start match/Save result/Confirm for real, since
   doing so requires the live write passphrase, which the agent does not have
   access to and should not attempt to guess.

**Known risks / gotcha found along the way:** running the bare `npx vitest run`
(no path filter) executes every `*.integration.test.ts`/`*.integration.test.tsx`
file too — these hit the **real, live** `racket-score` Supabase project using the
real seeded write passphrase (`src/test/testPassphrase.ts`, from the gitignored
`VITE_TEST_WRITE_PASSPHRASE` env var) with **no automatic cleanup**. Two bare
full-suite runs during this phase's step 5 left 16 stray `tournaments` rows and 36
stray `players` rows behind (named things like "Matches API Test ...", "Manually
Adjusted Test ..." — the same fixture-naming pattern visible in the integration
test source), cleanly separable from real data by `created_at` timestamp (stray
rows all landed in a couple of seconds around 15:43 and 15:49 UTC on 2026-08-03;
the real data all predates 12:06 UTC the same day) since `tournaments`/`players`
have no test-run marker column. Deleted via `execute_sql` after explicit user
confirmation (`tournaments`/`players` where `created_at >= '2026-08-03
13:00:00+00'` — cascades cleaned up the associated `matches`/`match_participants`/
`match_games`/`tournament_participants` rows automatically); verified back to the
exact pre-pollution counts (2 tournaments, 8 players, 13 matches, 15 participants)
afterward. This mirrors Phase 16's own step-8 walkthrough note (manually deleting
demo data via `execute_sql` afterward) — it's an accepted, known characteristic of
this project's integration-test setup, not something this phase changed, but
**prefer running targeted test file paths day-to-day** (as every step above
actually did) and budget a cleanup pass if a bare `vitest run` is ever needed.

---

## Critical Files

- `docs/SPEC.md`, `docs/RESEARCH.md` — source of truth for requirements/environment
- `src/features/matchmaking/generateNextMatch.ts` (+ helpers, including the `mandatoryIds`
  equal-match-count invariant in `selectCandidatePool.ts` and the mixed-doubles hard filter
  in `pickDoublesQuartet.ts`/`splitIntoTeams.ts`, per Phase 14) — the core algorithm;
  highest-risk, most heavily tested piece
- `src/features/matchmaking/isMixedDoublesRuleViolated.ts` — shared gender-violation check
  used by both manual-edit surfaces (Phase 14)
- `src/components/DrawSlotSelect.tsx` — shared inline-edit control for a drawn-but-not-yet-
  started match, used by both `TournamentDetail.tsx`'s Next match card and
  `FirstMatchDrawnPopup.tsx` (Phase 14)
- `src/features/tournaments/useCreateTournamentWithFirstDraw.ts` — computes the first-match
  draw but no longer persists it directly as of Phase 14; persistence is deferred to the
  popup's Confirm action (`useStartNextMatch`, reused from the Next-match flow)
- `src/lib/database.types.ts` — generated Supabase types underpinning the data-access layer
  (includes `matches.manually_adjusted`, added in Phase 14)
- Supabase migrations / `player_stats`, `tournament_standings`, and `player_match_history`
  views — source of truth for win-rate, effective skill level, and both scoreboards
- `src/features/tournaments/tournamentsApi.ts` (+ `useCancelTournament.ts`) —
  `cancelTournament` wraps the new `cancel_tournament` RPC; alongside `endTournament`/
  `useEndTournament`, together the only code paths that ever write `tournaments.status`
  (Phase 15)
- `cancel_tournament` Postgres RPC (live Supabase project only — no local migration file,
  applied/inspected via the Supabase MCP connector) — re-validates zero confirmed results
  server-side before deleting any queued match and flipping status to `cancelled` (Phase 15)
- `src/features/tournaments/TournamentDetail.tsx` — the danger zone now branches between
  Cancel Tournament (`completedMatches.length === 0`) and End Tournament, mutually
  exclusive per tournament (Phase 15)
- `app_secrets` table + `check_write_passphrase`/`verify_write_passphrase` Postgres functions
  (live Supabase project only, applied via the MCP connector — no local migration file) — the
  hashed-passphrase store and the shared internal check every write RPC below calls first;
  `check_write_passphrase` is locked to `postgres`/`service_role` only, `verify_write_passphrase`
  is the one `anon`-callable entry point the client's modal uses to validate a typed value
  without performing a write (Phase 16)
- Every write RPC (`create_player`, `update_player`, `create_tournament`, `add_participant`,
  `end_tournament`, plus the pre-existing `create_match`/`record_match_result`/
  `cancel_tournament`) — all `SECURITY DEFINER` with a pinned `search_path`, all require
  `p_passphrase` as their first line of business; `anon`'s direct `INSERT`/`UPDATE`/`DELETE`/
  `TRUNCATE` grants on `players`/`tournaments`/`tournament_participants`/`matches`/
  `match_participants`/`match_games` were revoked, so these RPCs are the *only* write path left,
  not just the recommended one (Phase 16)
- `src/features/passphrase/` (`PassphraseGateContext.ts`, `usePassphraseGate.ts`,
  `PassphraseGateProvider.tsx`, `passphraseApi.ts`) + `src/components/PassphraseModal.tsx` +
  `src/lib/passphraseStore.ts` — the client-side gate: `getPassphrase()` resolves from
  `sessionStorage` if cached, else opens the modal and resolves only after a successful
  `verify_write_passphrase` call; mounted once in `main.tsx`, wrapping `<App/>`, so every
  mutation hook can call `usePassphraseGate()` (Phase 16)
- Every mutation hook (`useCreatePlayer`, `useUpdatePlayer`, `useCreateTournamentWithFirstDraw`,
  `useAddParticipant`, `useEndTournament`, `useCancelTournament`, `useStartNextMatch`,
  `useRecordMatchResult`) — each resolves the passphrase once per logical action via
  `usePassphraseGate()` and threads it into its underlying `*Api.ts` call (Phase 16)
- `src/test/testPassphrase.ts` — the real write passphrase for anon-key integration tests, read
  from the local, gitignored `VITE_TEST_WRITE_PASSPHRASE` env var (never hardcoded in source);
  every `*.integration.test.ts` file that performs a write imports from here (Phase 16)
- `src/features/matches/useMatchQueue.ts` — `useStartNextMatch`'s `onSuccess` must `return` its
  `invalidateQueries(...)` call (not fire-and-forget it), or the Current-match exclusion race from
  Phase 17 step 1 resurfaces; regression-covered by `useMatchQueue.test.tsx`
- `src/features/tournaments/TournamentDetail.tsx` — `nextDraw` is now lifted out of `NextMatchCard`
  into the parent (controlled via `nextDraw`/`onNextDrawChange`) so `CurrentMatchForm` can gate
  Save Result on "has a Next match been drawn," with the "Is last match" checkbox as the only
  bypass (Phase 17)
- `src/features/scoreboard/rankScoreboard.ts` — the single ranking/tiebreak/tied-rank-numbering
  implementation shared by both Scoreboards (win-rate desc → total points desc → stable player-id
  order; standard competition ranking for ties); `src/features/tournaments/sortScoreboard.ts` was
  deleted as fully superseded by this (Phase 17)
- `src/features/scoreboard/ScoreboardTable.tsx` + `src/index.css`'s `.scoreboard-table*`/
  `.sticky-col` rules — shared table now takes a precomputed `rank` per row instead of deriving it
  from array index, and implements the frozen header row + frozen RANK/PHOTO/NAME columns via
  `position: sticky` (own bounded scroll box, `border-collapse: separate`, fixed column widths so
  `left` offsets are predictable) (Phase 17)

## End-to-End Verification

As of Phase 17, the full critical path has been exercised at three levels: pure-logic unit
tests (Vitest, no I/O), component/hook tests mocking the API layer (including the passphrase
gate itself), integration tests against the real Supabase project (via the JS client, exercising
the actual live RPCs with the real seeded passphrase, not a mock — 205 tests across the suite as
of this note), and full browser-driven runs (Phase 17's own smoke test used Claude-in-Chrome
against the local dev server instead of Playwright MCP, re-verifying against the *live* Supabase
data already in the project rather than fresh fixtures — see Phase 17 step 5). (Phase 16's
walkthrough, like Phase 15's, was run against the local dev server only; the deployed
Vercel URL has not yet been re-verified post-Phase-16 — see Phase 16 step 2's note that the live
Vercel deployment was left in a broken-writes state mid-phase and needs a push + redeploy before
it matches this local state). The path covered: create a player → create a tournament (singles or
doubles) → select participants from the pool → auto-drawn first match, optionally edited (with a
non-blocking gender-balance warning) before confirming → Randomize / Edit / Start the Next match in
Manage Tournament, including Current-match exclusion from the draw pool and its reuse-fallback
warning → record a result with valid/invalid scores (confirm-before-save, permanently locked
after) → win-rate scoreboards (per-tournament and cross-tournament Overall, with period/type
filters) and skill levels update live → History tab (both sections collapsible,
default-collapsed, manually-adjusted badges) → before a tournament's first result is confirmed,
Cancel it instead (confirm dialog, permanent, discards any drawn-but-unconfirmed match) and land
back on Active with it now absent, appearing in History's by-tournament list as a non-interactive
Cancelled row → **every one of those write actions now gated by the shared write passphrase**:
free browsing with no prompt, first write of the session opens the passphrase modal (wrong value
→ inline error, right value → proceeds and caches for the rest of the tab's session, reused
silently across every other write type without re-prompting), cancelling the modal aborts the
write rather than silently completing it, and closing/reopening the tab clears the cache so the
next write prompts again → toggle language and theme. All 5 tabs, both languages, no console
errors (dark-theme rendering specifically was not re-verified this phase — see Phase 16 step 9's
note; no new CSS was introduced, so risk is low but unconfirmed by tooling).

Phase 17 additionally re-verified, against the live app: the per-tournament Scoreboard's new
Total Points column and win-rate/total-points tiebreak ranking cross-checked number-for-number
against a hand-computed reference from earlier the same session; Overall Scoreboard's tied-rank
display (two real players tied at the same win-rate/points landing on the same rank number);
frozen header row and RANK/PHOTO/NAME columns on both Scoreboards under both vertical and
(artificially forced, since the viewport was wide enough not to overflow naturally) horizontal
scroll; and the Save-Result lock/"Is last match" checkbox toggling correctly on a real in-progress
match — stopping short of actually clicking Start match/Save result/Confirm, since those require
the live write passphrase, which the agent doesn't have and didn't attempt to obtain or guess.

## Phase 18 — Mid-Tournament Leave & Add Participant (Fairness Offset)

A spec-driven addition (`docs/SPEC.md` §4/§5/§9, `docs/IMPROVEMENT3.md`): lets the
organizer soft-remove ("Leave") a participant from an in-progress tournament and add
someone to the active roster mid-tournament — one action that covers both a genuinely
new late-joiner and a rejoin of someone who previously left, distinguished purely by
whether an existing `tournament_participants` row for that `(tournament_id,
player_id)` pair is currently `'left'`. `tournament_participants` gains two columns
(`status`, `match_count_offset`); the existing `add_participant` RPC (Phase 16,
currently a bare, unvalidated insert) is modified in place to become an
active-tournament-gated, fairness-offset-computing upsert, and a new sibling
`leave_participant` RPC is added, both following Phase 16's
`check_write_passphrase` → `security definer` → `set search_path` → `grant execute to
anon` pattern exactly. `useDrawInputs.ts`'s candidate assembly picks up both new
columns; `TournamentDetail.tsx` gets the two pieces of UI, and the already-shipped-but-
unused `useAddParticipant` hook is finally wired to real UI.

**Confirmed decisions (this session):**
- Leave is a soft-remove (`status: 'active' → 'left'`, row never deleted), immediately
  excludes the participant from the Match Generator's candidate pool
  (`useDrawInputs.ts`), and leaves History/Scoreboard untouched (those read
  `player_match_history`/`tournament_standings`, not `tournament_participants`).
- Leave is blocked while the participant is part of the in-progress Current match
  (`matches.status = 'queued'`) and blocked entirely once `tournaments.status !==
  'active'`; it uses the same two-step confirm-dialog-then-passphrase pattern as
  End/Cancel Tournament (`TournamentDetail.tsx` lines 175-237 today), including reusing
  the bare `manage.cancel` key for the dialog's dismiss button.
- If the left participant is part of the ephemeral, not-yet-persisted `nextDraw` state
  (owned by `TournamentDetail`, passed into `NextMatchCard`), Leave discards it
  (`onNextDrawChange(null)`) as a side effect — no server round-trip needed since it was
  never written.
- Add participant (mid-tournament) covers both late-join and rejoin with one RPC call:
  the picker's options are the member pool minus whoever is currently `status =
  'active'` on this tournament, so a previously-left participant reappears there and
  picking them again reactivates their existing row instead of erroring on the
  composite PK `(tournament_id, player_id)`. No confirm dialog — straight to the
  passphrase prompt, mirroring today's `addParticipant` call shape.
- Fairness offset: `match_count_offset = COALESCE(min(real completed count among
  currently-active other participants), 0) - thisPlayer'sOwnRealCompletedCount`,
  computed server-side inside `add_participant` from the `player_match_history` view
  (already one row per player per **completed** match, per its Phase 13 definition — no
  extra status filtering needed). The offset is folded into `useDrawInputs.ts`'s
  `matchesPlayedInTournament` for the draw algorithm only; every other real count
  (History, Scoreboard, win-rate) is untouched since none of those read
  `tournament_participants` at all.
- `add_participant`'s new body is an `INSERT ... ON CONFLICT (tournament_id,
  player_id) DO UPDATE ... WHERE tournament_participants.status <> 'active'` — a
  duplicate/stale call against an already-active participant is a safe no-op (offset
  not recomputed, no rows changed) rather than an error, since the picker's own
  exclusion logic should already prevent this but the RPC re-validates independently
  per this codebase's "server is the real enforcement" convention.
- New i18n keys live under the existing `manage.*` namespace, following its established
  naming convention (verb/noun action key, `confirm{Action}Title/Body/Button` for
  Leave's two-step dialog, dismiss always reuses bare `manage.cancel`). The pre-existing
  dead `tournaments.participants.addExistingHeading`/`createAndAdd`/etc. block (verified
  unreferenced anywhere in `src/` outside the i18n files themselves) is left untouched —
  out of scope, not repurposed.

1. [x] **Migration: `tournament_participants` schema (status + offset columns).** Via
   the Supabase MCP connector's `apply_migration`: `alter table
   tournament_participants add column status text not null default 'active' check
   (status in ('active', 'left')), add column match_count_offset integer not null
   default 0` — no separate backfill statement needed, since a `NOT NULL DEFAULT`
   column add in Postgres 11+ populates existing rows from the default without a table
   rewrite. `match_count_offset` intentionally has no `CHECK ... >= 0` — it must accept
   negative values (a rejoiner whose own real completed-match count exceeds the current
   active minimum). No RLS/grant changes needed: the table's RLS/anon-write posture is
   already fully locked down from Phase 16 (anon `INSERT/UPDATE/DELETE` already
   revoked; every write already goes exclusively through `add_participant`, and this
   phase's new `leave_participant`), so a plain column add is safe as-is. _Test:_
   `execute_sql` — confirms both columns exist with the stated types/defaults/check
   constraint; confirms every pre-existing row now reads `status = 'active'`,
   `match_count_offset = 0`; a scratch insert/rollback confirms a negative
   `match_count_offset` value is accepted (proving no unintended CHECK blocks it) and
   that `status = 'left'` is accepted while e.g. `status = 'bogus'` is rejected by the
   new CHECK constraint.
2. [x] **Migration: modify `add_participant` (active guard + fairness-offset upsert).**
   `CREATE OR REPLACE FUNCTION add_participant(p_tournament_id uuid, p_player_id uuid,
   p_passphrase text) RETURNS tournament_participants` — same signature as today (no
   grant/security changes needed; it's already `SECURITY DEFINER` with `search_path`
   pinned and `anon`-executable from Phase 16), but a new body: `perform
   check_write_passphrase(p_passphrase)` first (unchanged), then `raise exception
   'tournament_not_active'` unless the target tournament's `status = 'active'`; then
   compute `v_own_count` (`count(*) from player_match_history where tournament_id =
   p_tournament_id and player_id = p_player_id`) and `v_min_active_others`
   (`min(count(*) from player_match_history ... group by player_id)` over every other
   `tournament_participants` row on this tournament with `status = 'active'`), giving
   `v_offset := coalesce(v_min_active_others, 0) - v_own_count` (the `coalesce` covers
   the very-first-participant-ever case, where "other active participants" is empty);
   then `INSERT ... (tournament_id, player_id, status, match_count_offset) VALUES (...,
   'active', v_offset) ON CONFLICT (tournament_id, player_id) DO UPDATE SET status =
   'active', match_count_offset = v_offset WHERE tournament_participants.status <>
   'active' RETURNING * INTO v_participant`; since a `WHERE`-guarded `DO UPDATE` that
   doesn't fire returns no row, follow with `IF NOT FOUND THEN SELECT * INTO
   v_participant FROM tournament_participants WHERE tournament_id = p_tournament_id AND
   player_id = p_player_id; END IF` so an already-active no-op call still returns the
   current row rather than nothing. _Test:_ `execute_sql`, all against seeded fixture
   tournaments/players (cleaned up after): (a) brand-new participant added into a
   tournament with existing active participants at varying real completed counts —
   asserts `match_count_offset = min(others' real counts) - 0`; (b) rejoin — seed a
   `status = 'left'` row for a player with 2 real completed matches (via
   `player_match_history` fixture rows), re-add them, assert `status` flips back to
   `'active'` and the offset lands exactly on the current active minimum (asserting a
   *negative* offset case specifically, where the rejoiner's own count exceeds the
   minimum); (c) idempotency — call `add_participant` again on an already-`'active'`
   participant, assert the row and its `match_count_offset` are byte-for-byte unchanged
   (the `NOT FOUND` fallback path); (d) first-ever participant on a brand-new
   tournament — asserts `match_count_offset = 0` via the `coalesce` fallback, not an
   error; (e) tournament `status = 'completed'`/`'cancelled'` — rejects with
   `tournament_not_active`, no row change; (f) wrong passphrase — rejects before any of
   the above logic runs, no row change. `get_advisors` (security) spot-check — no new
   warnings beyond the pre-existing expected anon-executable-`SECURITY DEFINER` one.
3. [x] **Migration: new `leave_participant` RPC.** `CREATE FUNCTION
   leave_participant(p_tournament_id uuid, p_player_id uuid, p_passphrase text)
   RETURNS tournament_participants`, `security definer`, `set search_path = public,
   pg_temp`, explicit `grant execute on function leave_participant(uuid, uuid, text) to
   anon` — mirrors `cancel_tournament`'s/`end_tournament`'s creation ritual exactly.
   Body: `perform check_write_passphrase(p_passphrase)` first; `raise exception
   'tournament_not_active'` unless the tournament's `status = 'active'`; `raise
   exception 'participant_in_current_match'` if `exists (select 1 from
   match_participants mp join matches m on m.id = mp.match_id where m.tournament_id =
   p_tournament_id and m.status = 'queued' and mp.player_id = p_player_id)`; then
   `UPDATE tournament_participants SET status = 'left' WHERE tournament_id =
   p_tournament_id AND player_id = p_player_id AND status = 'active' RETURNING * INTO
   v_participant`, `raise exception 'participant_not_active'` if `NOT FOUND` (mirrors
   `update_player`/`end_tournament`'s not-found-raise convention from Phase 16, rather
   than silently no-op-ing — unlike Add, there's no spec requirement for Leave to be
   idempotent). Deliberately does **not** reset `match_count_offset` back to `0` on
   leave — it's meaningless while the row is inactive and gets fully recomputed by
   `add_participant` on any future re-add regardless of its stale value, so touching it
   here would be an unnecessary write. _Test:_ `execute_sql` against seeded fixtures:
   (a) active participant with no queued-match involvement — leave succeeds, `status`
   becomes `'left'`; (b) a participant who is one of a queued Current match's
   `match_participants` rows — rejects with `participant_in_current_match`, row
   unchanged; (c) tournament `status = 'completed'`/`'cancelled'` — rejects with
   `tournament_not_active`; (d) already-`'left'` or nonexistent `(tournament_id,
   player_id)` pair — rejects with `participant_not_active`; (e) wrong passphrase —
   rejects first, before any of the above checks, no row change. `get_advisors`
   (security) spot-check — only the expected new anon-executable-`SECURITY DEFINER`
   warning for `leave_participant`, nothing else new.
4. [x] **Regenerate TS types + advisors re-check.** `generate_typescript_types` →
   `src/lib/database.types.ts`, picking up `tournament_participants.status`/
   `match_count_offset` in the table's `Row`/`Insert`/`Update` shapes and
   `leave_participant`'s new `Functions` signature (`add_participant`'s signature is
   unchanged, so no client call site needs touching for it). _Test:_ `npm run build`
   (via `tsc -b`) — expect **zero new errors**: `tournamentsApi.ts`'s existing
   `addParticipant` call site still type-checks (same RPC args as before), and nothing
   in the client calls `leave_participant` yet (that's step 5), so this step's regen
   should be a clean, inert build on its own. `get_advisors` re-checked once more for
   drift.
   **Gotcha found here:** the "clean, inert build" prediction missed that several
   `*.test.tsx` files (`TournamentDetail.test.tsx`, `useCreateTournamentWithFirstDraw
   .test.tsx`, `CreateTournamentPage.test.tsx`) construct `TournamentParticipant`-typed
   fixture literals for `listParticipants`/`addParticipant` mocks — those objects'
   `Row` type is now stricter (two new required fields), so 13 fixture literals across
   3 files needed `status: 'active', match_count_offset: 0` added before `npm run
   build` was actually clean. Also caught (during the manual write, since
   `generate_typescript_types`' output can only be pasted into the file, not applied
   as a diff) a repeat of Phase 16 step 5's transcription-slip risk: the bottom
   boilerplate's helper type was mistyped as `DefaultSchemaWithoutInternals` instead of
   the generator's actual `DatabaseWithoutInternals`, and the final `CompositeTypes`
   branch as `DefaultSchema["CompositeTypes"][CompositeTypeName]` instead of
   `[PublicCompositeTypeNameOrOptions]` — both fixed by diffing back against the
   generator's literal output before running the build, not by inspection alone.
5. [x] **`tournamentsApi.ts`: add `leaveParticipant`.** New `leaveParticipant(
   tournamentId: string, playerId: string, passphrase: string):
   Promise<TournamentParticipant>` in `src/features/tournaments/tournamentsApi.ts`,
   wrapping `supabase.rpc('leave_participant', { p_tournament_id: tournamentId,
   p_player_id: playerId, p_passphrase: passphrase })`, mirroring `addParticipant`'s/
   `cancelTournament`'s exact shape (`if (error) throw error; return data`). No change
   to `addParticipant`'s signature or `listParticipants` (the latter now returns rows
   including `status`/`match_count_offset` for free, once types are regenerated — no
   code change needed there). _Test:_ new cases in
   `tournamentsApi.integration.test.ts` (new `describe('leaveParticipant (real
   project, anon key)', ...)` block, `try/finally` + `crypto.randomUUID()` fixture
   naming, mirroring the file's `cancelTournament` describe block's style): (a)
   round-trip — add a fixture participant, leave them, `listParticipants` shows
   `status: 'left'` for that row; (b) leave rejected while the participant is part of a
   queued match created via `createMatch` — `rejects.toThrow()`, and a follow-up
   `listParticipants` re-read confirms `status` is still `'active'` (no partial
   mutation); (c) leave rejected against an `endTournament`-completed fixture
   tournament. Also confirmed via existing-test audit: no current
   `tournamentsApi.integration.test.ts`/`useDrawInputs.integration.test.tsx` case calls
   `addParticipant` against an already-ended/cancelled tournament, so step 2's new
   active-tournament guard cannot break any pre-existing passing test.
   **Gotcha found here (pre-existing, not introduced by this phase):** running this
   file live revealed that its `finally`/`afterAll` cleanup blocks — in the new
   `leaveParticipant` tests *and* the pre-existing `cancelTournament`/top-level
   describe blocks — silently fail to delete their fixture rows. Since Phase 16
   revoked `anon`'s direct `INSERT`/`UPDATE`/`DELETE` grants on every base table
   (all writes must go through a passphrase RPC now), the anon-key `supabase.from(
   'tournaments').delete()...` calls these `finally` blocks use have had no
   privilege to actually delete anything since Phase 16 shipped — the Supabase JS
   client doesn't throw on a permission-denied delete by default, so the tests kept
   passing while quietly leaving fixture debris in the live project on every run.
   Manually swept the accumulated debris (6 tournaments + 4 players from this run,
   including three pre-existing "Cancel Test"/"Tournaments API Test" rows) via the
   Supabase MCP `execute_sql` (service-role, bypasses the grant). Left unfixed here
   as out-of-scope for this phase — the fix (routing cleanup through a
   passphrase-gated delete path, or a service-role-only test cleanup RPC) touches
   every anon-key integration test file, not just this one; flagging for a future
   narrow cleanup phase rather than scope-creeping it into Phase 18.
6. [x] **New `useLeaveParticipant.ts` hook (+ backfill `useAddParticipant.test.tsx`).**
   `src/features/tournaments/useLeaveParticipant.ts`, mirroring `useAddParticipant.ts`'s
   exact structure: takes `tournamentId`, resolves `getPassphrase()` from
   `usePassphraseGate()` inside `mutationFn`, calls `leaveParticipant(tournamentId,
   playerId, passphrase)`, and on success invalidates the same two query keys
   `useAddParticipant` does (`['tournamentParticipants', tournamentId]`,
   `['drawInputs', tournamentId]`) — both Leave and Add change the same candidate pool.
   `useAddParticipant.ts` currently has **zero test coverage** (verified: no
   `useAddParticipant.test.tsx` exists, and it has no callers anywhere in `src/` today)
   — since step 9 finally wires it to live UI, add `useAddParticipant.test.tsx` in this
   step too, alongside the new hook, both mirroring `useCancelTournament.test.tsx`'s
   exact pattern (`vi.mock('./tournamentsApi', ...)`, `vi.mock('../passphrase/
   usePassphraseGate', ...)` resolving `'test-passphrase'`, `renderHook` + `invalidateSpy`
   assertions). _Test:_ `useLeaveParticipant.test.tsx` — mock `tournamentsApi.
   leaveParticipant`, mock `usePassphraseGate` to resolve `'test-passphrase'`, assert
   `leaveParticipant` called with `(tournamentId, playerId, 'test-passphrase')` and both
   `invalidateQueries` calls fire on success. `useAddParticipant.test.tsx` — identical
   shape, asserting `addParticipant` called with `(tournamentId, playerId,
   'test-passphrase')` and the same two query keys invalidated.
7. [x] **`useDrawInputs.ts`: exclude left participants, fold in the offset.** In
   `assembleDrawInputs()` (`src/features/matches/useDrawInputs.ts`), filter
   `participants` to `participant.status === 'active'` before the `candidates.flatMap`
   that builds `CandidatePlayer[]`; change
   `matchesPlayedInTournament: matchCountByPlayer.get(participant.player_id) ?? 0` to
   `matchesPlayedInTournament: (matchCountByPlayer.get(participant.player_id) ?? 0) +
   (participant.match_count_offset ?? 0)`. No change to `CandidatePlayer`'s type or to
   `matchCountByPlayer`'s construction (it already only counts real completed matches
   via `getMatchHistory`, which already filters to `status = 'completed'`). _Test:_
   extend `useDrawInputs.integration.test.tsx`'s existing fixture-tournament test (reuse
   its `runId`/`playerIds`/`afterAll` cleanup helpers) with a fifth fixture participant
   who is left via `leaveParticipant` after being added (asserting they're **absent**
   from `candidates` entirely, and existing A/B/C/D assertions are unaffected) plus a
   sixth participant added via `addParticipant` *after* seeding some completed-match
   history for the existing four (so their computed offset is nonzero), asserting their
   `matchesPlayedInTournament` equals real-count-plus-offset — including confirming the
   existing test's unchanged assertion that A/B/C/D's `matchesPlayedInTournament` stays
   `2` (offset `0` for participants added at the very start, per the Known Risks
   reasoning below).
   **Gotcha found here:** the extra fixture setup (two more `createPlayer` calls plus
   an `addParticipant`/`leaveParticipant` round-trip for E and a third `addParticipant`
   for F, all real network round-trips against the live project) pushed this single
   `it` past Vitest's default 5000ms test timeout — bumped to an explicit `20000` as
   the `it(...)` call's third argument. Also re-confirmed the same pre-existing
   cleanup-permission gap from step 5's gotcha (this file's `afterAll` uses anon-key
   `supabase.from(...).delete()`, which has had no privilege to actually delete since
   Phase 16): 3 tournaments + 18 players accumulated across this step's several manual
   re-runs and were swept via `execute_sql` afterward.
8. [x] **`TournamentDetail.tsx`: Leave button, two-step confirm, greyed-out left rows.**
   Extract the current inline Participants block (lines 156-173) into a new
   `ParticipantsCard` subcomponent, following the file's existing pattern of
   self-contained subcomponents (`CurrentMatchCard`/`NextMatchCard`/
   `RoundsPlayedList`), receiving `tournamentId`, `participants`, `playerNameById`,
   `isActive`, `currentMatchParticipantIds` (already computed in the parent for
   `NextMatchCard`, reused as-is), `nextDraw`, `onNextDrawChange`. Internally:
   `useLeaveParticipant(tournamentId)`; local state `leavingParticipant: {
   playerId: string; name: string } | null` for which row's confirm dialog is open.
   Active rows get a `manage.leave` button, `disabled={!isActive ||
   currentMatchParticipantIds.includes(participant.player_id) ||
   leaveParticipant.isPending}`; clicking opens a `Modal` with `manage.confirmLeaveTitle`
   (interpolating `{{name}}`), `manage.confirmLeaveBody`, a `manage.cancel` dismiss
   button, and a `manage.confirmLeaveButton` confirm button whose handler calls
   `leaveParticipant.mutate(playerId, { onSuccess: () => { setLeavingParticipant(null);
   if (nextDraw?.some(p => p.playerId === playerId)) onNextDrawChange(null) } })` —
   mirroring End/Cancel's `handleConfirm*` shape, including leaving the dialog open
   with no extra error text on failure (same minimalism as those two). Rows with
   `status === 'left'` render with a new `.participant-left` CSS class on the `<li>`
   (new rule in `src/index.css`, `opacity: 0.5`, mirroring the existing
   `.icon-choice:disabled .icon-choice-option` convention) plus a `manage.leftBadge`
   `.badge` next to the name, and no Leave button. New i18n keys in both
   `en.json`/`th.json` under `manage`: `leave` ("Leave" / "ออก"), `confirmLeaveTitle`
   ("Remove {{name}} from this tournament?" / "นำ {{name}} ออกจากทัวร์นาเมนต์นี้หรือไม่?"),
   `confirmLeaveBody` ("They'll stop appearing in the Match Generator's draw pool. You
   can add them back later from this same list." / Thai equivalent),
   `confirmLeaveButton` ("Yes, remove" / "ใช่ นำออก"), `leftBadge` ("Left" / "ออกแล้ว").
   _Test:_ new `TournamentDetail.test.tsx` describe block `'TournamentDetail: Leave
   participant'` mirroring the Cancel block's shape: (a) Leave button visible+enabled
   for an active participant not on the Current match; (b) Leave button disabled for a
   participant who *is* on the queued Current match (fixture with a `'queued'` match
   whose participants include them); (c) Leave button absent entirely for a non-active
   tournament; (d) a `status: 'left'` fixture participant renders with the `Left`
   badge, `.participant-left` class, and no Leave button; (e) full click-through —
   click Leave → confirm-dialog text appears → `leaveParticipant` not yet called →
   click confirm → `waitFor` asserts it's called with `(tournamentId, playerId,
   'test-passphrase')`; (f) a case seeding `nextDraw` (via the existing
   Randomize-mocking pattern already used by the Next-match-card tests in this file) to
   include the left player, confirming `manage.notPickedYet` reappears (Next match
   cleared) after the Leave confirms, and a sibling case confirming `nextDraw` is
   **not** cleared when the left player isn't part of it.
   **Clarified during implementation:** this step's own prose said the Leave button's
   `disabled` prop should include `!isActive`, but its own test case (c) says the
   button should be **absent entirely** for a non-active tournament — those two are
   contradictory (a disabled-but-rendered button is not "absent"). Went with "absent":
   the button is conditionally rendered only when `isActive`, and `disabled` covers
   only the Current-match/pending conditions — this matches the established
   End/Cancel-tournament convention (whole danger-zone blocks are conditionally
   rendered, never just disabled-and-shown) and is what the test suite actually
   verifies.
9. [x] **`ParticipantsCard`: Add-participant picker, wiring `useAddParticipant`.**
   Same `ParticipantsCard` subcomponent from step 8 additionally takes `players` (the
   full member pool, already fetched in `TournamentDetail` via `usePlayers()`) and owns
   `useAddParticipant(tournamentId)` plus local state `selectedPlayerId: string`. Above
   the participant list, when `isActive`, render a small inline form: a `<select>`
   (`manage.addParticipantLabel` field label, a disabled default option
   `manage.addParticipantPlaceholder`) whose options are `players` filtered to exclude
   anyone with a **currently-`'active'`** row in `participants` (so a `'left'` row's
   player reappears, surfacing the rejoin path with no separate button, per spec), and
   a `manage.addParticipantButton` ("Add") button, `disabled={!selectedPlayerId ||
   addParticipant.isPending}`, calling `addParticipant.mutate(selectedPlayerId, {
   onSuccess: () => setSelectedPlayerId('') })` directly — **no confirm dialog**,
   straight to the passphrase prompt inside the hook, per spec. Show
   `manage.noPlayersToAdd` in place of the picker when the filtered options list is
   empty. Because there's no confirm dialog to naturally surface a failure (unlike
   Leave), add `{addParticipant.isError && <p className="field-error">{t(
   'manage.addParticipantFailed')}</p>}`, mirroring `NextMatchCard`'s existing
   `startNextMatch.isError` → `manage.drawFailed` pattern (the closest existing analog
   for a no-confirm-dialog mutation). Hidden entirely (picker + button) when
   `!isActive`. New i18n keys under `manage`: `addParticipant` ("Add participant" /
   "เพิ่มผู้เล่น"), `addParticipantLabel` ("Player" / "ผู้เล่น"),
   `addParticipantPlaceholder` ("Select a player…" / "เลือกผู้เล่น…"),
   `addParticipantButton` ("Add" / "เพิ่ม"), `noPlayersToAdd` ("Everyone in the member
   pool is already active in this tournament." / Thai equivalent),
   `addParticipantFailed` ("Couldn't add that participant. Please try again." / Thai
   equivalent). _Test:_ new `TournamentDetail.test.tsx` describe block
   `'TournamentDetail: Add participant'`: (a) picker+button visible when active, absent
   when not; (b) picker options exclude every currently-`'active'` fixture participant
   but **include** a `status: 'left'` fixture participant (proving the rejoin surface);
   (c) select + click Add calls `addParticipant` with `(tournamentId, selectedId,
   'test-passphrase')` and no dialog ever renders (assert no new
   `role="dialog"`/modal text appears before the call); (d) `manage.noPlayersToAdd`
   renders instead of the picker when every member is already active; (e) a rejected
   `addParticipant` call renders `manage.addParticipantFailed`.
   **Simplified during implementation:** dropped the separately-listed
   `manage.addParticipantLabel` ("Player") key — a two-line "Add participant" heading
   plus a "Player" field label for a single `<select>` was redundant; `manage
   .addParticipant` ("Add participant") now does double duty as the one field's
   visible label, consistent with not adding UI elements the acceptance criteria
   didn't actually require.
10. [x] **Full regression + walkthrough.** `npm run lint`, `npm run build`, `npm test`
    (run the new/touched files' targeted paths first, then the full suite). Playwright
    MCP click-through against the live dev server / live Supabase project: open an
    active tournament with ≥3 active participants → Participants section shows Leave
    buttons on every active row, none on any pre-existing left row → attempt Leave on
    the Current match's own participant, confirm it's disabled → Leave a different,
    idle participant → confirm dialog appears, dismiss it (nothing changes) → trigger
    it again, confirm for real → passphrase prompt → correct value → row greys out with
    a "Left" badge, disappears from a subsequent Randomize draw → separately, draw a
    Next match, then Leave one of the players in that draw → confirm Next match reverts
    to "not picked yet" → Add participant: open the picker, confirm the just-left
    player appears in it (rejoin path) alongside any genuinely new member, pick them,
    submit → passphrase prompt (no extra confirm dialog) → they reappear active in the
    list → draw a new match and confirm the rejoined/newly-added player is eligible and
    gets prioritized under the equal-match-count invariant consistent with their
    fairness offset → attempt both Leave and Add on an Ended/Cancelled tournament,
    confirm both are absent. Both languages, both themes, no console errors. Delete all
    walkthrough-created tournaments/players/participants afterward via `execute_sql`.
    **Actually run:** `npm run lint` (clean), `npm run build` (clean), `npx vitest run`
    full suite including integration tests against the live project (223/223 passing,
    48 files). Playwright MCP click-through against the local dev server + live
    Supabase project covered the full path above end-to-end: created a singles
    tournament with 4 participants (auto-drawn first match) → confirmed Leave
    disabled for both Current-match participants, enabled for the two idle ones →
    dismissed the confirm dialog once (no-op verified), then confirmed for real → row
    greyed out with a "Left" badge, cached passphrase reused with no re-prompt →
    Randomize with only 1 truly-idle player left correctly fell back to reusing a
    Current-match player with the warning, while the left participant was never
    reused even in that fallback (confirming §1.3's fallback and §4's unconditional
    left-exclusion are independently correct) → re-added the left participant via the
    picker (no confirm dialog, no re-prompt, instant reactivation) → Randomize then
    drew a clean pairing with no fallback needed → Leave on a participant who was
    part of that Next-match draw correctly reverted it to "Not picked yet" → Cancel
    tournament, then confirmed both Leave buttons and the entire Add-participant
    picker were completely absent on the now-cancelled tournament, with the earlier
    left participant's "Left" badge still correctly preserved. Repeated the
    create-and-inspect path in Thai (สร้าง → เพิ่มผู้เล่น/เลือกผู้เล่น.../เพิ่ม on the
    picker, ออก on each row, and the full "นำ {{name}} ออกจากทัวร์นาเมนต์นี้หรือไม่?"
    confirm dialog) — all new strings rendered correctly with proper interpolation, no
    missing-key fallbacks. Zero console errors or warnings across the entire session.
    Dark theme was **not** re-verified via a live toggle — this app has no in-app
    theme switch (only OS-level `prefers-color-scheme` is honored, same as every
    earlier phase's walkthrough note on this point) — instead verified by code review
    that the phase's only new CSS rule (`.participant-left { opacity: 0.5 }`) sets no
    colors of its own, and the reused `.badge` class already resolves entirely through
    the `--text`/`--bg`/`--border` custom properties that flip under the existing
    `prefers-color-scheme: dark` block, the same mechanism already validated visually
    in Phase 15's Cancelled-badge work. All walkthrough-created tournaments (2) were
    deleted via `execute_sql` afterward; no new players were created (existing pool
    members were reused), so no player cleanup was needed this time.

**Known risks:** RLS on `tournament_participants` is permissive `anon` per Phase 16's
established posture, so `add_participant`'s active-tournament/idempotency guard and
`leave_participant`'s active-tournament/current-match guard are the *only* real
enforcement — the picker's client-side exclusion list and the Leave button's
`disabled` state are UX conveniences, not security, exactly like every other RPC in
this codebase. The `ON CONFLICT ... WHERE status <> 'active'` upsert with a
`NOT FOUND`-then-`SELECT` fallback is new territory for this codebase (no prior RPC has
used a conditional `DO UPDATE`); it's correct under Postgres's row-level locking (two
concurrent `add_participant` calls for the same pair serialize on the row, one wins the
`UPDATE` and the other legitimately falls through to the plain `SELECT`), but it's
worth double-checking behavior under `execute_sql` against a genuinely concurrent
scenario rather than trusting single-threaded test runs, since it's a new pattern.
`useCreateTournamentWithFirstDraw.ts`'s creation-time loop calls the plain
`addParticipant` API function (not the hook) once per selected member against a
brand-new tournament with zero prior participants and zero completed matches — since
every participant's own real count is `0` and, per the `coalesce` fallback, the
active-others minimum is also always `0` at every iteration (no completed matches can
exist yet), the offset formula reduces to `0` for every creation-time add with no
special-casing, exactly as assumed; re-verify this holds via
`useCreateTournamentWithFirstDraw.test.tsx`/its integration counterpart and via
`useDrawInputs.integration.test.tsx`'s existing A/B/C/D fixture (step 7) rather than by
inspection alone, since this phase changes the RPC body those tests exercise. Finally,
a negative `matchesPlayedInTournament` is new input to `selectCandidatePool.ts`/
`generateNextMatch.ts`, which have only ever seen non-negative real counts before — the
equal-match-count invariant only ever compares relative values (min/max grouping)
rather than clamping or indexing on the count, so it should be unaffected, but this
phase should add an explicit negative-count fixture to that layer's existing test suite
rather than assume it, since it's genuinely never-before-exercised input.

---

## Phase 19 — Remove/Rename Member, Doubles Repeat-Pairing Fix

Driven by post-launch hands-on testing (not a SPEC/IMPROVEMENT-doc-driven phase like
13/17/18): the organizer has no way to fix a mistakenly-added Member, and manual
testing of a doubles tournament found the Next-match draw sometimes redrew the same
4 players / same pairing back to back (observed around Round 12-13 and 14-15).
Root cause for the second issue: `pickSinglesPair.ts` already filters out repeat
opponents via `pairingHistory.opponentPairs` as a final tiebreak, but
`pickDoublesQuartet.ts` never accepted `PairingHistory` at all — its pipeline went
straight from the skill-spread filter to a uniform random pick, so once
equal-match-count + gender-balance narrowed the field to a small tied group, the
same quartet could be redrawn with nothing discouraging it.

**Confirmed decisions (this session, before implementation):**
- Remove-member blocking rule: hard-delete is blocked if the player has **any**
  `match_participants` row (any status), **or** an **active** `tournament_participants`
  row (any tournament roster they're currently entered in, matches played or not). A
  player whose only tournament involvement is a past **Leave** (`status = 'left'`)
  does **not** block deletion — Leave is treated as already having removed them from
  that roster.
- The blocking rule is enforced **server-side** in the new `delete_player` RPC
  (source of truth), with a fast client-side pre-check in the UI
  (`total_matches === 0`) that's necessarily imperfect (can't see pending/in-progress
  matches or roster-only entries) — the RPC's rejection is what's actually
  authoritative, surfaced via a generic i18n error message rather than failing silently.
- Rename UI uses an edit-toggle (small edit affordance → input + Save/Cancel), not an
  always-visible input, since the Member table row is getting crowded with the new
  Remove button too.
- Doubles quartet repeat-avoidance scores a candidate quartet by **combined
  opponent+teammate pairing history among all 6 internal pairs** (not just opponent
  pairs), since at quartet-selection time it isn't yet known who'll be teamed with
  whom, and SPEC's wording ("opponents/teams who have not yet played each other")
  names both dimensions.

1. [x] **`pickDoublesQuartet.ts`: add `pairingHistory` param + repeat-exposure filter
   stage.** New signature `pickDoublesQuartet(pool, mandatoryIds = new Set(),
   pairingHistory)` — added as a required 3rd param (not inserted before
   `mandatoryIds`, unlike `pickSinglesPair`'s ordering) to keep the two existing
   positional args stable for the one real call site. New helper
   `quartetRepeatExposure(quartet, history)` sums, over all C(4,2)=6 pairs in the
   quartet, +1 if the pair is in `opponentPairs`, +1 if in `teammatePairs`. Insert a
   new `minExposure`/filter stage after the skill-spread filter, before the random
   pick (same min-then-filter shape as `splitIntoTeams.ts`'s `repeatCount`). Update
   `generateNextMatch.ts`'s call site to pass the already-in-scope `pairingHistory`.
   _Test:_ `npx tsc -b` — the only resulting errors should be in
   `pickDoublesQuartet.test.ts`, confirming the signature change propagated correctly.

2. [x] **Update existing `pickDoublesQuartet.test.ts` call sites.** Add an
   `emptyHistory()` helper (cloned from `splitIntoTeams.test.ts`), pass it as the 3rd
   arg in all existing test cases.
   _Test:_ `npx tsc -b` clean; `npx vitest run
   src/features/matchmaking/pickDoublesQuartet.test.ts` — all pre-existing tests
   still pass unchanged.

3. [x] **Add two new repeat-avoidance tests**, mirroring `splitIntoTeams.test.ts`'s
   template: (a) prefers the lower-repeat-exposure quartet when candidates tie on
   gender-balance/skill-spread; (b) falls back to a repeat-containing quartet when
   every remaining option has one.
   _Test:_ `npx vitest run src/features/matchmaking/pickDoublesQuartet.test.ts`.

4. [x] **Full matchmaking regression + build.**
   _Test:_ `npx vitest run src/features/matchmaking`; `npm run build`; `npm run lint`.
   All 53 tests pass (51 pre-existing + 2 new), `tsc -b` and `vite build` clean,
   `eslint .` clean.

5. [x] **Manual spot-check via dev server.** Ran a small doubles roster through
   enough draws to reach a tied scenario, confirm the Next Match draw avoids
   repeating the same quartet when a non-repeat option exists. In practice
   (see combined manual-verification note after step 15) the specific live
   scenario reached was a genuine full tie (every candidate quartet had
   identical repeat-exposure, since round 1 fully connected its 4 players),
   so the live run confirmed the new code path executes correctly end-to-end
   without demonstrating discrimination on its own -- the discriminating
   behavior itself is what the new unit tests (steps 2-3) pin down
   deterministically.

6. [x] **New `EditablePlayerName.tsx`**, sibling of `EditablePlayerLevel.tsx`:
   edit-toggle (`isEditing` state) rather than always-visible input; not-editing
   shows name text + small edit button; editing shows a text input + Save (disabled
   while pending, unchanged, or empty-after-trim) + Cancel. Reuses
   `useUpdatePlayer()` unmodified (its RPC already accepts optional `p_name`, no
   schema change needed). Wire into `PlayerList.tsx` in place of the current plain
   name cell. Add `players.editableName.*` i18n keys to both `en.json`/`th.json`.
   _Test:_ `npx tsc -b`; `npm run lint`; extend `PlayerList.test.tsx` — name shows as
   text + edit affordance by default, clicking reveals a pre-filled input, saving a
   new value calls mocked `updatePlayer` with `{name: <trimmed>}`.

7. [x] **Manual browser verification of rename.** Renamed a disposable test member
   on the Member tab via dev server (Thai locale, the app's current default),
   confirmed the new name persisted after a full page reload, confirmed a
   direct Supabase query reflected it.

8. [x] **Migration: new `delete_player(p_id, p_passphrase)` RPC** via Supabase MCP
   `apply_migration` (no local migration files exist in this repo — all DDL is
   applied live per this project's established convention), mirroring
   `update_player`'s structure (`security definer`, `check_write_passphrase` first).
   Body: raise `player_has_matches` if any `match_participants` row exists for the
   player; raise `player_in_tournament` if any `tournament_participants` row exists
   with `status <> 'left'`; otherwise delete. Grant execute to `anon`.
   _Test:_ via `execute_sql` against disposable fixture rows (cleaned up after): (a)
   wrong passphrase → rejects; (b) player with zero history → deletes successfully;
   (c) player with only a `status = 'left'` tournament row and no matches → deletes
   successfully; (d) player with an active tournament roster row, no matches →
   rejects with `player_in_tournament`; (e) player with a `match_participants` row
   (pending match is enough) → rejects with `player_has_matches`. Then
   `get_advisors` (security) — expect exactly one new anon-executable `SECURITY
   DEFINER` advisory, consistent with every other write RPC.

9. [x] **Regenerate `database.types.ts`** via Supabase MCP `generate_typescript_types`.
   _Test:_ `npx tsc -b` — zero new errors (nothing calls it yet).

10. [x] **Data layer: `deletePlayer(id, passphrase)`** in `playersApi.ts`, following
    `createPlayer`/`updatePlayer`'s exact shape.
    _Test:_ `npx tsc -b`; new `deletePlayer.integration.test.ts` (mirroring
    `playerStatsLiveness.integration.test.ts`'s real-anon-key fixture convention):
    deletes a disposable no-history player and confirms it's gone from
    `listPlayers()`; creates a disposable player + match and confirms `deletePlayer`
    rejects (with manual fixture cleanup in `afterAll` since the delete itself
    correctly refused).

11. [x] **Hook layer: `useDeletePlayer.ts`**, mirroring `useUpdatePlayer.ts` —
    passphrase gate, then `deletePlayer`, `onSuccess` invalidates
    `['players']`/`['playerStats']`.
    _Test:_ `npx tsc -b` (verified indirectly via the component tests in steps 12/13,
    matching how `useCreatePlayer`/`useUpdatePlayer` have no standalone hook test today).

12. [x] **UI: Remove button with client-side pre-check.** New actions column in
    `PlayerList.tsx`; button `disabled` when `(stats?.total_matches ?? 0) > 0`, with
    a `title` explaining why when disabled; code comment noting this pre-check can't
    see pending matches or active-roster-only cases — the RPC is the real authority.
    _Test:_ extend `PlayerList.test.tsx` — player with matches renders disabled
    button; player with none renders enabled button.

13. [x] **UI: confirm dialog + delete flow + graceful error surfacing.** Clone
    `TournamentDetail.tsx`'s "Leave participant" pattern exactly: local
    pending-target state, `Modal` component, `.danger` confirm button,
    `member.confirmRemove*` i18n keys (both locales) reusing `manage.cancel` for
    Cancel. On mutation error, render a canned `member.removeFailed` i18n string —
    matches this app's existing convention of never surfacing raw RPC error text
    anywhere.
    _Test:_ extend `PlayerList.test.tsx` — clicking Remove opens the modal with the
    name interpolated; Cancel closes with no mutation call; Confirm calls mocked
    `deletePlayer` and closes on success; a mocked-rejection case shows the generic
    error message and leaves the modal open.

14. [x] **Full regression + build.** `npm run build`; `npm run lint`; `npx vitest
    run` (whole suite). All 236 tests pass, `tsc -b` and `vite build` clean,
    `eslint .` clean. (Two live-integration tests timed out once when the
    whole suite ran under network contention against the real Supabase
    project, and passed cleanly on re-run in isolation and on a full re-run —
    pre-existing flakiness unrelated to this phase's changes.)

15. [x] **Manual verification via dev server / Playwright MCP.** (a) removed a
    disposable no-history member (created via the live Add-member form), confirmed
    it disappeared from the Member tab immediately and from a direct Supabase query
    afterward; (b) confirmed a member with real completed-match history (an
    existing `player_stats`-liveness fixture) rendered a disabled Remove button;
    (c) exercised the pre-check blind spot organically -- a leftover fixture player
    from this phase's own integration test had a *pending* (never completed) match,
    so `total_matches` read 0 and the Remove button was enabled client-side exactly
    as documented; clicking it through to Confirm correctly hit the RPC's
    server-side `player_has_matches` guard and the UI rendered the graceful
    `member.removeFailed` message with the modal staying open (no crash, no
    silent no-op) -- this is the real scenario item (c) called for, encountered
    naturally rather than needing a purpose-built fixture.

    A combined pass also covered doubles matchmaking (Feature C step 5): created 6
    disposable players (3M/3F) and a doubles tournament, played round 1, drew
    round 2's Next match under Phase 18's current-match-exclusion (confirmed the
    "reuses someone currently playing" warning fires correctly when only 2 of 6
    are free), and confirmed the new repeat-exposure stage in `pickDoublesQuartet`
    executes without error and returns a valid quartet on a live draw. All fixture
    players/tournaments created during this pass were deleted afterward via
    `execute_sql` (tournament delete cascades matches/participants per the
    `ON DELETE CASCADE` FKs discovered in step 8; players deleted directly since
    this was done via the Supabase service-role connection, not the app's anon
    client).

**Flagged, not in scope for this phase:** three integration test files
(`playersApi.integration.test.ts`, `playerStatsLiveness.integration.test.ts`,
`playerLevelCutover.integration.test.ts`) call `supabase.from('players').delete()`
directly in their `afterAll` cleanup, but `anon` lost `DELETE` privilege on
`players` back in Phase 16 — these cleanups likely fail silently, leaving orphan
rows. Once `deletePlayer()` exists it could fix these, but that's a separate,
opportunistic cleanup to confirm with the user afterward — not silently bundled into
this phase.

**Known risks:** `delete_player`'s two `EXISTS` checks (`match_participants`,
active `tournament_participants`) are the *only* thing standing between a delete
call and real data loss — during implementation it was discovered that
`match_participants_player_id_fkey` and `tournament_participants_player_id_fkey`
are both `ON DELETE CASCADE` on the live schema (not the `RESTRICT`/`NO ACTION`
originally assumed during planning), so a hypothetical future edit to this RPC
that removed or loosened either `EXISTS` guard would silently cascade-delete a
player's match history rather than fail loudly at the database level. Any future
change to `delete_player` should re-verify this against the live schema (e.g.
`select confdeltype from pg_constraint where confrelid = 'players'::regclass`)
before assuming a foreign key will catch a mistake. Separately, the client-side
Remove-button pre-check (`total_matches === 0`) is a genuinely incomplete signal,
not just defensively worded: it only counts *completed* matches and only reads
`player_stats`, so a player with a queued-but-unplayed match or an active
tournament-roster-only entry shows an enabled button — this was exercised live
(step 15c) and worked as designed (graceful rejection), but a future UI pass
could tighten the pre-check by also querying `match_participants`/
`tournament_participants` existence directly if the current UX (enabled button,
then a rejection message) proves confusing in practice. Finally,
`pickDoublesQuartet`'s new `quartetRepeatExposure` score can't distinguish
"these two would be teammates" from "these two would be opponents" the way
`splitIntoTeams`'s `repeatCount` can (team assignment hasn't happened yet at
quartet-selection time) — this is a deliberate, documented simplification (see
step 1's design justification), not an oversight, but it means a repeat *teammate*
pairing and a repeat *opponent* pairing are weighted identically at this stage,
which could theoretically be revisited if real usage shows one matters more than
the other.

## Phase 20 — Multi-Sport Support (Badminton + Tennis)

Driven by `docs/IMPROVEMENT4.md` (concept confirmed via a one-question-at-a-time
interview, 2026-08-10): the app now supports **Tennis** alongside Badminton, chosen
at app entry via a new Home screen and switchable at any time via a persistent
header control. Every existing feature (matchmaking, scoring engine, tournament
lifecycle, both scoreboards) is reused unchanged per sport; only the player-level
model and navigation gain a sport dimension. This is the largest schema/architecture
change since Phase 13 — every player now has two independent skill/stat identities
(one per sport) instead of one.

**Confirmed decisions (see `IMPROVEMENT4.md` §0 for full rationale):** both
self-selected and win-rate-derived effective level split per sport; every tab
filters to the active sport workspace; Tennis reuses the badminton scoring engine
byte-for-byte (no real tennis rules); matchmaking itself is 100% unchanged, only
which `player_stats` rows feed it changes scope; all pre-existing data migrated to
`sport = 'badminton'`; a member with no level in the active sport can't be selected
as a participant until one is set on the Member tab.

1. [x] **Schema migrations + RPC/view updates** via Supabase MCP `apply_migration`
   against the live project: split `players.self_selected_level` into
   `badminton_self_selected_level`/`tennis_self_selected_level` (nullable, existing
   values backfilled to the badminton column); added `tournaments.sport` (`not null
   default 'badminton'`, check-constrained to `badminton`/`tennis`); updated
   `create_player`/`update_player`/`create_tournament` RPCs to take `p_sport` (old
   overloads explicitly dropped, since Postgres doesn't replace a function whose
   parameter list changed); rewrote `player_stats` as a sport-scoped view (2 rows per
   player, cross-joined against both sports) so `total_matches`/`win_rate`/
   `effective_level` are computed independently per sport; added `sport` to
   `player_match_history`. `tournament_standings` needed no change (already scoped to
   one tournament, which now has a fixed sport).
   _Test:_ verified live via `execute_sql` with disposable fixtures — backfill
   correctness, both-or-neither `update_player` guard, per-sport RPC branching, and
   (most critically) cross-sport isolation: seeded one badminton match and one tennis
   match for the same two players and confirmed each sport's `player_stats` row
   reflected only that sport's result. `get_advisors` confirmed no new write path
   opened. `generate_typescript_types` regenerated `database.types.ts`.

2. [x] **`src/features/sport/` module**: `sportTypes.ts` (`SPORTS`/`Sport`, mirrors
   `playerLevels.ts`), `SportContext.ts`/`SportProvider.tsx`/`useSport.ts` (mirrors
   the passphrase-gate context/provider/hook pattern, minus the blocking-modal
   machinery), backed by `src/lib/sportStore.ts` (`localStorage`, not
   `sessionStorage`, since the choice must persist across restarts). Wired into
   `main.tsx` alongside `PassphraseGateProvider`.
   _Test:_ new `sportStore.test.ts`, `SportProvider.test.tsx` (initial null, restores
   from a pre-seeded value, `setSport` updates + persists, throws outside provider).

3. [x] **Home screen + routing gate + nav switcher.** New `src/pages/HomePage.tsx`
   (full-screen icon picker, user-supplied `badminton.png`/`tennis.png` assets, no
   bottom nav). `AppLayout.tsx` redirects to `/home` when `sport === null` and adds a
   header switcher button back to `/home`. `App.tsx` adds the `/home` route outside
   the `AppLayout` route group.
   _Test:_ new `HomePage.test.tsx`; rewrote `App.test.tsx` to wrap with a real
   `SportProvider` and cover the no-sport-cached redirect, sport-pick-lands-on-Create,
   and header-switcher-navigates-to-Home cases.

4. [x] **Data-layer sport-threading**: `playersApi.ts` (hand-written
   `CreatePlayerInput`/`UpdatePlayerInput`, sport-filtered `getPlayerStats`/
   `listPlayerStats`), `tournamentsApi.ts` (`CreateTournamentInput.sport`,
   optional-filter `listTournaments`), `useDrawInputs.ts` (`sport` as an explicit
   required param, not read from `useSport()` — lets `TournamentDetail` pass a
   tournament's own fixed sport instead of the ambient workspace),
   `usePlayerStatsList.ts`, `useTournaments.ts`, `scoreboardApi.ts`/
   `useOverallScoreboard.ts`, `matchesApi.ts`'s `listRecentCompletedMatches`
   (`tournaments!inner(name, sport)` embed + filter).
   _Test:_ `npx tsc -b` narrowed incrementally after each file, confirming errors
   propagated to callers as expected rather than being masked.

5. [x] **`TournamentDetail.tsx`: missing-level exclusion in the participant
   picker.** Reads the tournament's own fixed `sport`, passes it into
   `usePlayerStatsList`/`useDrawInputs`; the Add-participant `<select>`'s options
   render `disabled` with a `title` tooltip when the sport-scoped
   `self_selected_level` is `null` — with a fail-open guard (`stats === undefined` ⇒
   not disabled) so options aren't all disabled during the brief window before stats
   load.
   _Test:_ extended `TournamentDetail.test.tsx` with a fixture player missing the
   sport-scoped level, asserting the disabled option + tooltip, using `waitFor` since
   the fail-open→correct-disabled transition is async.

6. [x] **i18n additions** (`en.json`/`th.json`, in parallel): `home.*`,
   `sport.badminton`/`sport.tennis`, `nav.switchSport`,
   `tournaments.form.participantMissingLevel`, `member.levelNotSet`.

7. [x] **Member page**: `CreatePlayerForm.tsx` scopes new-member level entry to
   `useSport()`'s active sport. `EditablePlayerLevel.tsx` rewritten to take
   `{playerId, playerName, stats, sport}` (drops the `Player` prop entirely — the
   sport-scoped level lives on `stats`); three states (not-set prompt / editable
   pre-filled / fixed computed), returns `null` while `stats` is still loading.
   `PlayerList.tsx` wires `usePlayerStatsList(sport)` through.
   _Test:_ extended `PlayerList.test.tsx` with a `self_selected_level: null` fixture
   covering the not-set prompt and its save call.

8. [x] **`CreateTournamentPage.tsx`, `useCreateTournamentWithFirstDraw.ts`,
   `HistoryPage.tsx`, `ActivePage.tsx`, `OverallScoreboardPage.tsx`**: threaded
   `sport` from `useSport()` (or, for the post-creation draw, from the just-submitted
   tournament input) into every list/query call and the participant checklist's
   missing-level disabling.
   _Test:_ extended each page's existing test file with a mocked `useSport`,
   asserting the sport value reaches the underlying data call.

9. [x] **Integration test fixture updates** (7 files, live Supabase project): every
   `createPlayer`/`createTournament`/`getPlayerStats`/`useDrawInputs` call updated to
   pass `sport: 'badminton'` explicitly, matching the new required RPC/function
   signatures. Also fixed `supabaseClient.integration.test.ts`'s direct-insert probe,
   which referenced the now-dropped `self_selected_level` column.
   _Test:_ all 22 integration tests pass against the live project.

10. [x] **Full regression.** `npm run build` (`tsc -b && vite build`); `npm run lint`;
    `npm run format`; `npx vitest run` (whole suite).
    _Test:_ `tsc -b`/`vite build`/`eslint .` all clean; all 249 tests pass across 52
    files (including all 8 live-integration files).

11. [x] **Manual verification via dev server / Playwright MCP.** First-launch (no
    `localStorage`) correctly gated to Home with no bottom nav; picking a sport
    landed on Create with the tab bar visible; the header switcher round-tripped to
    Home and back; a full page reload with a sport already chosen skipped Home
    entirely. Cross-sport isolation verified against real data: every pre-existing
    (migrated) member showed correctly disabled with the missing-level tooltip in the
    Tennis workspace and correctly enabled in Badminton; created a disposable member
    live, confirmed their Badminton level appeared immediately (see bug note below),
    confirmed they were disabled in Tennis, set their Tennis level from Member,
    confirmed they became selectable in Tennis without affecting their Badminton
    state. Fixture member cleaned up afterward via `execute_sql`.

**Bug found and fixed during manual verification:** `useCreatePlayer.ts`'s
`onSuccess` only invalidated the `['players']` query key, not `['playerStats']` (unlike
`useDeletePlayer.ts`, which already invalidated both). Before Phase 20,
`EditablePlayerLevel` read `player.self_selected_level` directly and so worked
regardless of whether the stats query had refetched; after Phase 20 it depends
entirely on the sport-scoped `stats` row and renders nothing (`return null`) while
`stats` is `undefined`. The combination meant a freshly-created member's level cell
stayed permanently blank in an already-mounted session until some unrelated
invalidation happened to refetch `playerStats`. Fixed by adding the missing
`invalidateQueries({ queryKey: ['playerStats'] })` call; verified live by creating a
second disposable member in the same session and confirming its level cell populated
immediately with no reload.
