# Badminton Battle & Scoreboard App — Specification

Confirmed: 2026-07-30
Updated: 2026-07-31 — added §8 (Final Tournament Scoreboard) and §9
(Application Flow / Pages), based on post-launch UI feedback.
Updated: 2026-07-31 (later same day) — superseded by `IMPROVEMENT.md`'s
navigation/flow overhaul (5-tab bottom nav, mandatory create-time-only
participant selection, unified win-rate scoreboard, new cross-tournament
Overall Scoreboard, placeholder avatars). §3, §4, §6-§9 revised below;
this replaces the single-scroll / 4-page flow from the previous update,
which was never implemented.
Updated: 2026-07-31 (later still) — incorporates `IMPROVEMENT2.md`'s
post-launch corrections on top of the shipped Phase 13 app: hard-invariant
equal match counts, hard-filter mixed-gender doubles, Current-match draw
exclusion, manual editing of a drawn-but-not-yet-started match, and
collapsible (default-collapsed) History sections. §5, §6, and §9 revised
below. Not yet implemented as of this note — see `docs/IMPROVEMENT2.md`.
Updated: 2026-08-02 — adds **Cancel Tournament** (§4, §9): a permanent,
non-reversible way to discard a tournament created by mistake, available
only before its first match result is confirmed, in place of End
Tournament during that window. Not yet implemented as of this note.
Updated: 2026-08-02 (later same day) — adds a **write-access passphrase**
(§2): a single shared secret required before any create/edit/record
action, enforced at the database (RLS/RPC) level rather than only in the
UI. Reading/browsing stays open to anyone, unchanged. Not yet implemented
as of this note.
Updated: 2026-08-03 — post-launch corrections found during real usage: a
match-generator exclusion bugfix and a new "must draw Next before saving
Current's result" workflow lock (§5, §6, §9), plus unifying the two
scoreboards' columns/ranking and adding frozen header/identity columns to
both (§7, §8). Not yet implemented as of this note.
Updated: 2026-08-07 — adds **mid-tournament roster changes** (§4, §5, §9),
based on `docs/IMPROVEMENT3.md`: a participant can **Leave** an in-progress
tournament (soft-remove, reversible), and the organizer can **Add
participant** to add a late arrival or bring back someone who left
(rejoin), both gated behind the existing write-access passphrase (§2) and
blocked once the tournament has ended or been cancelled. This is a
**deliberate reversal** of §4's earlier "participants are chosen once, at
creation time, and never after" rule — see §4 for the reversal note. Not
yet implemented as of this note.
Updated: 2026-08-10 — adds **multi-sport support** (§1, §3, §4, §9), based
on `docs/IMPROVEMENT4.md`: the app now supports **Tennis** alongside
Badminton, chosen at app entry via a new **Home** screen and switchable at
any time. A player's skill level (both self-selected and win-rate-derived)
is now tracked **independently per sport** — the two sports never share
match history, stats, or level for the same person. Every existing screen
and rule (scoring engine, Match Generator, both scoreboards, mid-tournament
roster changes) is reused unchanged per sport; only the player-level and
navigation model changes. Not yet implemented as of this note — see
`docs/IMPROVEMENT4.md` for the full schema/file-level plan.
Updated: 2026-08-17 — refines the Create Tournament form (§4): Games per
match / Points per game now start blank (no prefilled default) and use a
−/+ stepper input (also directly typeable), and Tennis's Points per game
is fixed at 4 rather than organizer-entered, shown disabled/faded in the
form instead of hidden. Implemented as of this note.
Updated: 2026-08-23 — two small corrections found during real usage of the
Next match card (§6, §9): (1) the Next match card's **Edit** action now
opens as a popup with a read-only reference table (every participant's
games-played count in this tournament, including the in-progress Current
match, sorted fewest-to-most) shown alongside the existing player pickers,
so the organizer can see who's played least while swapping players — the
first-match creation popup (§9, tab 1) is unchanged. (2) a Next match
draw that's been randomized but not yet started is now kept in the
browser's local storage, keyed by tournament, so navigating away and back
no longer loses it; it's cleared once Start match promotes it into
Current match. Not yet implemented as of this note.
Updated: 2026-09-14 — adds the ability to permanently delete a confirmed
match result (§6) via a passphrase-gated confirm dialog (§2) that previews
per-player stat impact, accessible from History for any match or as a
quick-undo on the Manage screen immediately after confirming the result,
regardless of whether the tournament is still active or has already ended;
in-place score editing remains unsupported. Based on Phase 23 in
`docs/PLAN.md`. Not yet implemented as of this note.
Updated: 2026-10-08 — adds **multi-court tournaments** (§4, §5, §6, §9),
replacing the earlier "Single court" model: the organizer picks a number of
courts (1-8) at creation, each court runs its own in-progress match
concurrently, and a shared pre-drawn queue of up to **courts + 1** matches
feeds whichever court frees up first. The Match Generator's fairness inputs
now count planned matches (§5), and match labels change from "Round N" to
"Match N" with a court name (§9). A tournament created before this change
is a 1-court tournament and behaves as before. Implemented (Phase 24 in
`docs/PLAN.md`).

## 1. Overview

A web app for running racket-sport "battle" sessions — currently
**Badminton and Tennis** — using **balanced random matchmaking** — not a
fixed round-robin bracket where every pair must meet exactly once, but a
generator that draws one match at a time based on fairness rules. Includes
a central player pool, shared across both sports, with cross-tournament
history/stats and standings within each tournament. The organizer chooses
which sport's "workspace" to work in (§9); every tournament belongs to
exactly one sport, and a player's stats/level are tracked separately per
sport (§3).

## 2. Technology & Hosting

- **Frontend:** React
- **Backend/Database:** Supabase (new project, created for this app)
- **Deployment:** Vercel
- **No user accounts / login system.** Anyone can browse the app — the
  member pool, tournaments, matches, and both scoreboards — without any
  credential. Real per-user auth, roles, or edit-vs-view link separation
  remain a future enhancement, not part of this spec.
- **Write-access passphrase.** Every action that creates or modifies data
  (adding/editing a member, creating a tournament, drawing/starting/
  editing a match, recording a result, ending or cancelling a tournament)
  requires a single **shared passphrase** — one secret for the whole app,
  not per-tournament or per-person. This is enforced at the **database**
  level, not just hidden in the UI:
  - Every write goes through a **Postgres RPC function** that takes the
    passphrase as a parameter, checks it against a **hashed** value stored
    in a settings table, and only performs the insert/update if it
    matches. The underlying tables have `INSERT`/`UPDATE`/`DELETE`
    revoked for the `anon` role, so a write is only possible through one
    of these passphrase-checked functions — never a direct table call.
  - The passphrase is seeded once via a database migration and stored
    only as a hash; there is no in-app Settings screen to change it —
    changing it means writing and running a new migration.
  - **In the UI:** browsing/reading needs nothing — there's no gate on
    app entry. The **first** write-triggering action in a browser session
    (e.g. tapping "Create tournament" or "Save result") pops up a
    passphrase prompt. A correct entry completes that action and is
    remembered for the rest of the browser session (cleared when the tab/
    browser closes — not persisted longer than that), so later write
    actions in the same session aren't re-prompted, though each is still
    independently re-checked against the database. A wrong entry just
    shows an inline error and can be retried any number of times — no
    lockout or rate-limiting. The one exception: permanently deleting a
    confirmed match result (§6) always requires the passphrase typed
    fresh into its own confirm dialog, never reading from or writing to
    the session-cached passphrase.
  - Applies uniformly to every write path, present and future — any new
    create/edit/delete action added later must go through the same
    RPC-plus-passphrase pattern, not a direct table write.
- **UI language:** Thai and English, switchable in-app.

## 3. Player Pool (central, persistent)

- Players are created once in a shared pool and reused across
  tournaments **and across both sports** — the same person is the same
  member record whether they're playing Badminton or Tennis. Only their
  skill level and stats are tracked separately per sport (below);
  everything else about a member (name, gender, avatar) is shared.
- Fields: **name, gender, skill level (per sport)**. A photo is displayed
  everywhere a player/member is listed (member list, tournament
  participant checklist, scoreboards), but for now this is always a
  **generated placeholder avatar** (initials + a color derived from the
  name) — there is no photo upload capability or `photo`/`avatar_url`
  column in this phase. Real upload (Supabase Storage) is explicitly
  deferred (see Out of scope).
- **Skill level — tracked independently per sport.** A player has a
  separate Badminton level and Tennis level; playing one sport never
  affects the other's level or match count.
  - New to a sport (fewer than 3 recorded matches **in that sport**)
    means the player self-selects an initial level for it: `Beginner /
    Intermediate / Advanced / Pro`. This is set from whichever sport's
    workspace (§9) is active at the time — creating/editing a member
    while in the Tennis workspace only sets their Tennis level, leaving
    Badminton untouched (and vice versa).
  - Once a player has **3 or more** recorded matches **in that sport**,
    their level for that sport is computed automatically from their
    **win rate in that sport** and displayed instead of the
    self-selected value, using the same fixed win-rate bands as before,
    applied per sport.
  - A member who has never played (or been given a self-selected level
    for) one of the two sports has **no level in that sport** until an
    organizer sets one from the Member tab (§9). Such a member cannot be
    selected as a participant in that sport's tournaments until a level
    is set.
- **Doubles pairs are never persisted as a standing entity.** Every
  tournament re-pairs players from the individual pool; there is no
  reusable "team" object.

## 4. Tournaments

- A tournament belongs to **exactly one sport** (Badminton or Tennis),
  fixed to whichever sport's workspace (§9) was active when it was
  created — there is no way to change a tournament's sport after
  creation, and no cross-sport tournament. This determines which of a
  participant's two independent skill-level/stat identities (§3) the
  Match Generator (§5) and both scoreboards (§7, §8) read for that
  tournament — never a mix of both.
- **Tennis reuses Badminton's scoring engine exactly** — the same
  games-per-match / points-per-game / win-by / BWF-ratio deuce-cap system
  described below applies to both sports identically. This is a
  deliberate simplification: Tennis tournaments do **not** use real
  tennis scoring (no sets, no 40-40/advantage deuce, no tie-break at 6
  games). The one difference is **points per game is not
  organizer-configurable for Tennis** (below) — Badminton is the only
  sport where the organizer picks this value.
- A tournament is **one match type only**: singles OR doubles, chosen at
  creation. Running both requires two separate tournaments.
- **Number of courts (set at creation, 1-8).** Chosen on the Create
  Tournament form (§9, tab 1) and **fixed for the life of the tournament**
  — there is no way to add or remove a court afterward (to change it, the
  organizer creates a new tournament; a tournament with no confirmed match
  can be cancelled, §4). A tournament created before this setting existed
  has 1 court. Courts are interchangeable and named **Court 1 … Court n**.
- Per-tournament scoring configuration (set at creation):
  - Number of games per match (e.g. best of 1, best of 3, ...) —
    organizer-defined for both sports. The Create Tournament form's
    Games per match / Points per game inputs start **blank** (no
    prefilled default) and are edited with a stepper control (−/+
    buttons, floor of 1, no ceiling) or by typing a number directly.
  - Target points per game (e.g. 15 / 21 / 25) — **organizer-defined
    for Badminton only**. For Tennis, this is **fixed at 4** (not
    editable): the Create Tournament form still shows the field for
    visibility, but rendered disabled/faded at its fixed value rather
    than hidden, so the fixed target stays legible instead of silently
    disappearing.
  - Deuce rule: must win by 2 points, capped at a ceiling scaled to the
    target (mirrors BWF's 21-point-target/30-cap ratio). Score entry is
    validated against this rule. The Create Tournament form's "Deuce
    cap: N" line only renders once a points-per-game value is resolved
    (always true for Tennis, since it's fixed; shown for Badminton once
    the organizer has entered a value).
- **Participants are selected at creation time, from the member pool** —
  this remains the *only* way to build the initial roster. Once the
  tournament is running, the roster can still change in two narrow,
  explicitly-gated ways (below); there is still no general-purpose "edit
  the roster" screen. (An earlier draft of this spec allowed late joins at
  any time; that was reversed once, then partially re-reversed again here
  — see the two bullets below and `docs/IMPROVEMENT3.md`.)
- **Leave (mid-tournament, per participant).** An active participant can be
  marked as **left** — a soft, reversible removal (`status = 'left'`, no
  row deleted). A left participant is immediately excluded from the Match
  Generator's candidate pool (§5) but stays visible (greyed out) in the
  Participants list, and nothing about their already-completed matches
  changes in History or either Scoreboard. Leave is **blocked** while the
  participant is in the in-progress match of **any court** (§9) — they must
  finish that match first — and blocked entirely once the tournament has
  ended or been cancelled. Triggering Leave asks for confirmation before
  the write-access passphrase prompt (§2), same two-step pattern as Cancel/
  End Tournament. If the participant being left is part of one or more
  already-drawn but not-yet-started **queued matches** (§9), Leave is still
  allowed and each queued match containing them is discarded automatically
  (they haven't started, so nothing is lost except those pairings — queued
  matches that don't include them are untouched, and the organizer draws
  replacements).
- **Add participant (mid-tournament: late arrival or rejoin).** The
  organizer can add someone to an in-progress tournament's active roster
  from the member pool, minus whoever is already active on this
  tournament. This covers two cases with one action:
  - **A genuinely new participant** for this tournament: added with a
    **fairness offset** equal to the lowest `matchesPlayedInTournament`
    among currently-active participants, so the Match Generator (§5) treats
    them as level with whoever's currently furthest behind rather than
    penalizing them for arriving late.
  - **Someone who previously left this same tournament** (a participant
    whose row is `status = 'left'`): re-adding them through this same
    action **reactivates** their existing row (`status` back to `active`)
    rather than creating a duplicate — this is how "rejoin" works; there is
    no separate rejoin button. Because they may already have real completed
    matches from before they left, their fairness offset is recomputed so
    their fairness-facing match count lands exactly on the current
    lowest-count tier (offset = lowest active count − their real completed
    count so far), not stacked on top of the plain new-participant formula.
  - Either way, the offset is **invisible outside the draw algorithm** —
    every displayed match count, win rate, and Scoreboard/History figure
    always reflects real completed matches only, never the offset. Add
    participant has no extra confirm dialog beyond the passphrase prompt
    (matching how adding participants works at creation time), and is
    blocked entirely once the tournament has ended or been cancelled.
- **Multiple courts, one shared queue.** With *n* courts (above), up to *n*
  matches are in progress at the same time, at most one per court. Matches
  that are drawn but not yet started wait in a single shared **queue**,
  ordered first-drawn-first, holding **at most n + 1** matches (so one
  court's worth plus one spare, e.g. 3 courts → at most 3 in progress and
  4 queued). When a court's result is confirmed and the court frees up, the
  **head of the queue** is the match that goes onto that court — but it
  only starts when the organizer taps **Start match** for that court (§9);
  nothing is auto-promoted. A match is "in progress" from Start match until
  its result is confirmed. At most one match is ever in progress on a given
  court, and a participant can never be in two in-progress matches at once
  (Start match is blocked in that case, §9). A 1-court tournament works
  like the former single-court model — one in-progress match — except that
  its queue now holds up to 2 matches instead of 1.
- Tournament ends when the **organizer manually stops it** — there is no
  fixed number of matches or rounds decided in advance.
- **Cancelling** a tournament is a separate, permanent action available
  only **before its first match result is confirmed** — intended for a
  tournament created by mistake or no longer wanted, not for abandoning
  one that's already underway. During that window the organizer sees a
  **Cancel** action instead of End Tournament (§9); once a first result
  is confirmed, Cancel disappears for good and the normal End Tournament
  flow takes over. Cancelling sets the tournament's status to
  **cancelled**, discards any drawn-but-unconfirmed match (queued or
  in progress on any court — §9), and cannot be undone; there is no
  reactivation path back to active. Because it's only available pre-first-result, a cancelled
  tournament never has any confirmed match data, so it cannot affect
  `player_stats` or scoreboard views.

## 5. Match Generator (balanced random draw)

Organizer clicks a button to draw one match at a time, or to fill the whole
queue at once (§4, §9); drawn matches wait in the shared queue until
started. Every match is drawn individually with the rules below —
gender and skill balance apply **within each match** and are **not**
balanced across courts or across queue positions (courts are
interchangeable, so there is nothing to balance between them). Selection
priority, in order:

1. **Equal match count** — a **hard invariant**, not just a preference: the
   gap between the most-played and least-played participant must never
   exceed 1, at every point in the tournament. Players with the fewest
   matches played so far are always drawn first; if that lowest-count
   group has fewer players than the match needs, **every** player in it is
   included in the draw, and only the remaining seats are filled from the
   next-lowest group — the algorithm may never skip a lowest-count player
   in favor of a better skill/gender fit elsewhere in the pool.
2. **Skill balance** — pair opponents (or, for doubles, split the 4 drawn
   players into 2 teams) to be as evenly matched as possible. Uses the
   player's real win-rate percentage once they have ≥3 matches; for players
   below that threshold, uses an approximate midpoint value derived from
   their self-selected category (e.g. Beginner ≈ 12.5%, Intermediate ≈
   37.5%, Advanced ≈ 62.5%, Pro ≈ 87.5%) as a stand-in.
3. **Gender balance** — when the tournament has more than one gender
   represented, balance gender distribution within the match and, for
   doubles, within each team.
4. **Avoid repeat pairings** — prefer opponents/teams who have not yet
   played each other in this tournament. Only allow a repeat when no
   other combination satisfies the constraints above.

**Doubles-specific correction (gender balance is a hard filter, not a
tiebreak):** the priority order above (skill balance before gender
balance) is the **singles** order. For **doubles**, gender balance is
promoted above skill balance at both steps of the draw:

- **Quartet selection**: among the candidate players from step 1, any
  quartet with exactly 2 males and 2 females is preferred over any 3-1 or
  4-0 quartet **regardless of skill spread**. Skill spread is only used to
  break ties among quartets that are equally gender-balanced.
- **Team split**: given a chosen quartet, a split where both teams are
  gender-mixed (1 male + 1 female each) is preferred over any split with a
  same-gender team, **regardless of skill-sum difference**. Skill-sum
  difference and repeat-pairing avoidance are only used to break ties
  among splits that are equally (best-available) mixed.

So the effective doubles order is: equal match count → gender balance
(hard) → skill balance → avoid repeat pairings. The singles order is
unchanged: equal match count → skill balance → gender balance → avoid
repeat pairings.

**Planned match count (multi-court).** With several courts and a queue,
"matches played" for the fairness rule (item 1 above) is the player's
**planned match count**: completed matches + matches in progress on any
court + matches already waiting in the queue ahead of the one being drawn.
Item 1's hard invariant (gap of at most 1) is applied to this planned
count, so a player already committed to a court or an earlier queue slot is
naturally drawn after those who are not. (This replaces the earlier
"exclude players who are on court" rule; the displayed match counts,
win rates and scoreboards still reflect real completed matches only, never
planned ones.) Repeat-pairing avoidance (item 4) likewise treats in-progress
and already-queued matches as having been played.

**Avoiding the same player twice at once — soft, with a fallback.** Because
the planned count already steers the draw away from players who are on
court or queued, a player is only drawn into a second queued/in-progress
slot when too few other players remain to fill the match (for example, 12
players on 2 doubles courts leaves only 4 free players for a queue that
can hold 3 matches). In that case the draw is allowed anyway, with a
visible warning in the UI that someone was reused — the same fallback the
former single-court rule used. The warning is derived from the current
queue and in-progress rosters rather than remembered from the draw, so it
stays visible for as long as an overlap exists (including after a reload or
an edit) and disappears once it is resolved. The reuse is only ever about
*queued* matches: a match cannot be started while any of its players is in another
in-progress match (§4, §9).

The planned-count inputs must always reflect each in-progress and queued
match's **actual, up-to-date roster** — including any inline edit made via
§6's manual-adjust affordance — never a stale or pre-edit snapshot.

**Excluding participants who left:** a participant marked as **left**
(§4) is removed from the candidate pool entirely, unconditionally — unlike
the soft reuse fallback above, there is no fallback that reuses a left
participant, since they've told the organizer they're not available. A
participant added mid-tournament (§4, late arrival or rejoin) enters the
pool with their **fairness offset** already folded into the
`matchesPlayedInTournament` value the generator sees, so the existing
equal-match-count invariant (item 1 above) applies to them exactly as it
does to everyone else, with no special-casing needed elsewhere in the
algorithm.

## 6. Match Result Recording

- Results are entered **after the match ends** as a summary per game
  (e.g. `21-15`, `18-21`, `21-19`) — no live point-by-point scoring.
- Entered scores are validated against the tournament's configured
  scoring rules (target points, win-by-2, cap).
- Before saving, the organizer reviews the two sides and the entered
  score in a confirmation dialog ("Confirm this result? It can't be
  edited after." / Cancel / Confirm). **Once confirmed, a result is
  permanently locked** — there is no edit affordance for a completed
  match anywhere in the app. However, a confirmed match can be permanently
  deleted via a passphrase-gated confirm dialog (accessible from History
  for any match, or as a quick-undo on the Manage screen on the tournament's
  most recently confirmed result), regardless of whether the tournament is
  still active or has already ended. The confirm dialog previews per-player
  stat impact; deletion is a hard delete of the match, its games, and its
  participants, and does not renumber `sequence_number` or restore any
  court or queue state.
- This lock applies only to a **result** once confirmed. A match that has
  been drawn but **not yet started** — one of the auto-drawn first matches
  (still showing the creation-time confirmation popup) or a match still
  waiting in the queue (§9) — can still be edited: the
  organizer swaps out one or more drawn players for someone else from the
  tournament's participant pool, inline in the same popup/card (this
  applies to every queued match, not only the head of the queue). Editing a
  draw is unrelated to editing a result — there's no "result" yet to
  protect. The app **warns, but does not block**, if the edited lineup
  violates §5's gender-balance rule; the organizer can still confirm the
  override. An edited draw is flagged as manually adjusted, and that flag
  is visible later in History (§9).
- **Queued match Edit popup (games-played reference table).** For a match
  in the queue specifically (not the tournament-creation first-matches
  popup, which edits inline in its own list, §9 tab 1) — the Edit action
  opens as a **popup** titled with the match's position ("Edit queue
  match 2 of 3") with two stacked sections: the same per-slot player
  pickers as before, on top, unchanged; and below them, a **read-only
  reference table** listing every participant in the tournament with their
  games-played count *in this tournament* — completed matches, plus one
  more for each in-progress match (on any court) the player is part of —
  and a **"Now" column** showing where the player currently is: the court
  they are playing on ("Court 2"), their position in the queue ("Queue
  #1", for each queued match they are in other than the one being edited),
  or "—" if free. The table is sorted from fewest games played to most. The table exists to help the organizer spot who's
  played least before choosing a swap; player swaps still happen only
  through the pickers above it, not by interacting with the table.
- **The queue must not be empty before a court's result can be saved.**
  For every in-progress match — manually adjusted or not — that court's
  **Save result** button (§9) stays disabled until the queue holds **at
  least one** drawn match (it does not need to be full at n + 1). This
  guarantees the freed court always has a next match ready and that §5's
  planned counts are up to date before that match's outcome is locked in.
  The organizer can bypass this by checking that court's **"Is last
  match"** checkbox next to its Save result: checking it only unlocks the
  button for this one save on this one court — it does not draw a match,
  end the tournament, or change any other state, and other courts are
  unaffected. The tournament remains **active** afterward; ending it still
  requires the separate End tournament action (§4, §9).

## 7. Tournament Scoreboard (per tournament)

A single ranking view, scoped to one tournament, that works identically
whether the tournament is still active or already ended — there is no
separate "live standings" screen and "final scoreboard" screen; they are
the same view at different points in the tournament's life. (This
replaces the earlier draft's split between an in-progress games-won
standings table and a separate post-end scoreboard.)

Participants are ranked by:

1. **Match win rate within this tournament** — matches won ÷ matches
   played in this tournament, descending. A participant with 0 matches
   played ranks below one who has played and lost every match (i.e. a
   real 0% win rate outranks "hasn't played yet").
2. **Total points scored** (cumulative points scored across this
   tournament's matches, not a differential) — tiebreaker, same metric and
   column as §8's Overall Scoreboard.

If both are tied, ranks are **not** broken further — tied participants
share the same rank number.

Each row shows: photo/avatar, name, matches played, matches won, total
points scored, win rate — the same column set as §8's Overall Scoreboard.
Ranks 1–3 get a medal icon instead of a plain number.

**Frozen header/columns:** the table's header row and its RANK, PHOTO, and
NAME columns stay fixed in place while the remaining columns scroll
horizontally/vertically underneath — same behavior as §8's Overall
Scoreboard.

Reached by: opening a tournament from the History tab's tournament list
(works for both active and ended tournaments, showing the live/partial
ranking for an active one), or automatically right after confirming "End
tournament" (§9).

## 8. Overall Scoreboard (cross-tournament)

A second, separate ranking — the app's main tab-3 destination — computed
across **all of a player's matches, in all tournaments**, not scoped to
any single tournament:

1. **Overall match win rate** — total matches won ÷ total matches played,
   descending, across every tournament the player has participated in.
2. **Total points scored** — tiebreaker, same aggregation scope (replaces
   the point-differential tiebreaker used in an earlier draft of this
   spec).

If both are tied, ranks are **not** broken further — tied players share
the same rank number.

Each row shows: photo/avatar, name, matches played, matches won, **total
points scored** (cumulative points scored across all their matches — not
a differential), win rate. Ranks 1–3 get a medal icon.

**Frozen header/columns:** the table's header row and its RANK, PHOTO, and
NAME columns stay fixed in place while the remaining columns scroll
horizontally/vertically underneath.

**Filters**, two independent, freely-combinable groups:
- **Period**: All time / This month (calendar month, i.e. matches
  completed since the 1st of the current month).
- **Match type**: All / Singles / Doubles (a player's doubles-tournament
  matches vs. singles-tournament matches).

All displayed columns (matches played/won, points, win rate) recompute
for the active period × type combination, not just the win-rate sort.

## 9. Application Flow (Navigation & Pages)

**0. Home (sport selection).** Before anything else, the organizer picks a
**sport workspace** — Badminton or Tennis — via an icon picker. This is a
full-screen gate with no bottom nav: the very first time the app is ever
opened, Home is the only thing shown; once a sport is picked, that choice
is remembered (persists across app restarts, not just the browser session)
and later visits skip straight into that sport's tab flow below. A
**persistent switcher control**, always present in the app header
alongside the language toggle, returns to Home at any time to change the
active sport. **Every tab below is scoped to whichever sport is currently
active** — Create/Active/Scoreboard/History/Member all show only that
sport's tournaments, matches, and stats; there is no combined or
"both sports" view anywhere.

The app then uses a 5-tab bottom navigation bar, always visible, present
at every screen size (not a responsive top-nav on wider viewports):

1. **Create** — create a new tournament: name, type (§4), **number of
   courts** (1-8, a stepper like games per match; defaults to 1 and cannot
   be changed after creation, §4), games per
   match, points per game, and a checklist of all members to select as
   participants (each row shows photo/avatar, name, level for the active
   sport — this is the **only** place participants are ever chosen, per
   §4). A member with **no level yet in the active sport** (§3) appears
   disabled in this checklist, with an explanation that they need a level
   set on the Member tab first before they can be selected. On submit: the
   tournament and its participants are created, the **first n matches**
   (n = number of courts) are drawn immediately per the Match Generator
   (§5), one after another so each counts toward the next's planned counts,
   and shown together in a confirmation popup (titled "First match
   drawn" for a 1-court tournament, "First *n* matches drawn" otherwise); on
   confirm they are placed in the queue (not auto-started — the organizer taps Start match per court,
   below), and the organizer is taken directly into that tournament's
   Manage screen (tab 2's drill-down, below) — the new tournament also
   appears in tab 2's list automatically. If the roster is too small to
   give all n matches different players, the later matches reuse players
   with the same visible warning as §5; the roster must still be large
   enough for at least one match, as before. The popup lists the n drawn
   matches as **compact one-line rows** (numbered in queue order, so all of
   them stay visible even with 8 courts); tapping a row's **Edit** action
   (§6) expands just that row in place into the player pickers, with a
   **Done** button to collapse it again, so only one match is being edited
   at a time. A reuse warning (§5) appears under the list when it applies.
   **Confirm** sits below the list.
2. **Active** — list of tournaments currently in progress. Each card:
   name, type, current match number (e.g. "Match 7" — the highest match
   number started so far, "Match 0" before the first Start match; there is no fixed total match count and therefore
   no progress fraction/bar).
   Tapping a card opens **Manage tournament** for it:
   - **Participants** — the tournament's roster (photo/avatar, name, level),
     each active row with a **Leave** button (§4) that opens a confirm
     dialog before the passphrase prompt, disabled while that participant
     is in the in-progress match of any court; participants who left show greyed out
     in the same list rather than a separate section. An **Add
     participant** entry point above/near the list opens a picker over the
     member pool (minus everyone already active on this tournament — which
     includes anyone who left, letting them be picked again to rejoin, §4)
     and goes straight to the passphrase prompt with no extra confirm.
     Both Leave and Add participant are hidden/disabled once the
     tournament is no longer active (ended or cancelled).
   - **Courts** — one card per court (Court 1 … Court n, in a stacked list
     on phone widths), each independent of the others. A court card shows
     the two sides playing there now, each side's name directly above its
     own score input (unambiguous which input belongs to which side), that
     court's own **Save result** button (and "Is last match" checkbox, §6).
     Courts always stay in court-number order. A court with a match in
     progress is shown as a full card; a **free court collapses to a
     one-line strip** ("Court N · free") carrying a **Start match** button
     that names the queue's head match (e.g. "Start ▶ Ice + Jay vs …"),
     disabled with a short hint when the queue is empty. The **Queue**
     (below) sits underneath all the court cards.
     **Start match** moves the **head of the queue** onto that court
     (resetting score inputs) and removes it from the queue (and from the stored queue). It is **blocked, with an explanation,** if
     any player in that match is currently in another court's in-progress
     match — the organizer can edit the match (§6) or wait. Starting a
     match gives it the next match number (continuing the tournament's
     single sequence across all courts, in the order matches were
     started) and records which court it is on.
   - **Queue** — shared by all courts, listed in play order (first-drawn
     first), holding at most **n + 1** matches (n = number of courts); empty
     at first only if nothing has been drawn yet. Two draw actions, both
     manual and on demand (nothing is drawn automatically after the
     tournament's creation-time draw in tab 1): **Randomize** adds one
     match to the end of the queue (§5), and **Fill queue** keeps drawing
     until the queue holds n + 1 matches or no further match can be drawn;
     both are disabled when the queue is already full. Each queued match
     has its own **Edit** action (§6) that opens a popup — player pickers
     on top, a read-only games-played reference table below (§6) — to swap
     out one or more drawn players before it starts, and a **Remove** action
     to drop it from the queue; an edited match is flagged as manually
     adjusted (visible later in History). The queue is kept in the
     browser's local storage, keyed by tournament (the same mechanism the
     former single Next-match draw used), so leaving this screen and coming
     back (or reloading) doesn't lose it; like before, it lives on that one
     device/browser only.
   - **Save result** (on a court card) opens a confirmation dialog (§6)
     before locking the result in; on confirm, it's appended to **Matches
     played** (newest first, showing "Match N" plus the court name when the
     tournament has more than one court — e.g. "Match 7 · Court 2" — both
     sides, winning side bolded/accented, final score), and that court
     returns to free. The queue is not auto-promoted — the organizer must
     tap Start match on the freed court. Saving one court's result never
     affects the other courts' in-progress matches.
   - **Cancel tournament** (danger-styled) — shown in place of End
     tournament, and only until the tournament's first match result is
     confirmed (§4). Opens a confirm dialog warning the action is
     permanent and can't be undone; on confirm, the tournament's status
     flips to **cancelled**, any drawn-but-unconfirmed match (queued or
     in progress on any court) is discarded, and the organizer returns to the Active tab
     (the tournament no longer appears there — it moves to History,
     below). Once a first result is confirmed, this action disappears
     permanently and End tournament takes its place, as below.
   - **End tournament** (danger-styled) opens a confirm dialog; on
     confirm the tournament's status flips to ended and the organizer
     lands on that tournament's Scoreboard (§7).
3. **Scoreboard** — the Overall Scoreboard (§8).
4. **History** — two sections, **by match** (every completed match
   across all tournaments, active or ended, newest first, same row
   format as Matches played) and **by tournament** (every tournament —
   active, ended, or cancelled; tapping an active or ended one opens its
   per-tournament Scoreboard, §7 — a cancelled tournament is listed with
   a **Cancelled** badge in place of Active/Completed but has no
   Scoreboard to open, since cancelling is only possible before any
   match result exists). Each section has its own show more / show less
   toggle in its
   heading (top-right), independent of the other; both default to
   **collapsed** (heading only — no peek of items) so the organizer
   opts in to scrolling through history rather than it being forced on
   page load.
5. **Member** — the central player pool, shared across both sports (§3):
   an "add member" form (name, gender as an icon-toggle, level as a
   dropdown **for the active sport only**, no photo upload per §3) above
   a list of **all** current members regardless of sport (photo/avatar,
   name, level for the active sport). A member with no level yet in the
   active sport shows a distinct "not set" state with the same dropdown
   used to set one for the first time — this is how a member becomes
   eligible for that sport's tournaments (§4/tab 1, above). This tab is
   **only** for managing the member pool — it has no tournament-
   participation controls (see §4's create-time-only rule).

## Out of scope / explicitly deferred

- Real-time push updates (viewers refresh manually or on a polling
  interval — no live sync requirement).
- Authentication, roles, or per-tournament edit/view link separation.
- Automatic court assignment/auto-start, and changing a tournament's court
  count after creation (§4) — courts are interchangeable and the organizer
  taps Start match per court. Cross-device sharing of the queue (it is
  browser-local, §9).
- Persistent doubles "teams" as a first-class entity.
- Live, point-by-point scoreboard mode.
- Real player photo upload/storage — placeholder avatars only for now
  (§3).
- Editing/correcting a confirmed result's scores in place (§6) — whole-match deletion is supported starting Phase 23.
- A dedicated "rejoin" UI distinct from Add participant — rejoining a
  participant who left reuses the same Add participant action (§4).
- Real-time/automatic re-draw of a queued match when a participant leaves
  — the affected queued matches are simply discarded, not regenerated
  (§4); the organizer taps Randomize or Fill queue again manually.
