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
    lockout or rate-limiting.
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
  participant is one of the Current match's participants (§9) — they must
  finish that match first — and blocked entirely once the tournament has
  ended or been cancelled. Triggering Leave asks for confirmation before
  the write-access passphrase prompt (§2), same two-step pattern as Cancel/
  End Tournament. If the participant being left is part of an already-drawn
  but not-yet-started **Next match** (§9), Leave is still allowed and the
  Next match draw is discarded automatically (it hasn't started, so nothing
  is lost except the pairing itself — the organizer draws again).
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
- **Single court**: matches are played one at a time. The system does not
  need to track concurrent in-progress matches across multiple courts,
  though the organizer can pre-generate the next match into a queue while
  the current one is still being played.
- Tournament ends when the **organizer manually stops it** — there is no
  fixed number of matches or rounds decided in advance.
- **Cancelling** a tournament is a separate, permanent action available
  only **before its first match result is confirmed** — intended for a
  tournament created by mistake or no longer wanted, not for abandoning
  one that's already underway. During that window the organizer sees a
  **Cancel** action instead of End Tournament (§9); once a first result
  is confirmed, Cancel disappears for good and the normal End Tournament
  flow takes over. Cancelling sets the tournament's status to
  **cancelled**, discards any drawn-but-unconfirmed match (Next or
  Current — §9), and cannot be undone; there is no reactivation path back
  to active. Because it's only available pre-first-result, a cancelled
  tournament never has any confirmed match data, so it cannot affect
  `player_stats` or scoreboard views.

## 5. Match Generator (balanced random draw)

Organizer clicks a button to draw one match at a time (can queue the next
match in advance). Selection priority, in order:

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

**Excluding in-progress players:** while a Current match is in progress
(§9), its participants are excluded from the candidate pool used to draw
Next match — a player can't be drawn again while still on court. The
excluded set must always be the Current match's **actual, up-to-date
roster** — including any inline edit made via §6's manual-adjust affordance
— never a stale or pre-edit snapshot; a player swapped into Current by a
manual adjustment must be excluded from Next just as much as one who was
drawn there normally. If excluding them would leave too few players to
fill Next match, they may be reused as a fallback, with a visible warning
in the UI that this happened.

**Excluding participants who left:** a participant marked as **left**
(§4) is removed from the candidate pool entirely, unconditionally — unlike
the Current-match exclusion above, there is no fallback that reuses a left
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
  match anywhere in the app, and no admin-override path. Getting a score
  wrong means it stays wrong; this is a deliberate simplification, not an
  oversight.
- This lock applies only to a **result** once confirmed. A match that has
  been drawn but **not yet started** — the tournament's auto-drawn first
  match (still showing its creation-time confirmation popup) or a Next
  match not yet promoted via Start match (§9) — can still be edited: the
  organizer swaps out one or more drawn players for someone else from the
  tournament's participant pool, inline in the same popup/card. Editing a
  draw is unrelated to editing a result — there's no "result" yet to
  protect. The app **warns, but does not block**, if the edited lineup
  violates §5's gender-balance rule; the organizer can still confirm the
  override. An edited draw is flagged as manually adjusted, and that flag
  is visible later in History (§9).
- **Next match must be drawn before Current match's result can be saved.**
  For every Current match — manually adjusted or not — the **Save result**
  button (§9) stays disabled until a Next match has been randomized. This
  guarantees §5's exclusion rule always has an up-to-date Current roster to
  draw against before that match's outcome is locked in. The organizer can
  bypass this by checking an **"Is last match"** checkbox next to Save
  result: checking it only unlocks the button for this one save — it does
  not draw a match, end the tournament, or change any other state. The
  tournament remains **active** afterward; ending it still requires the
  separate End tournament action (§4, §9).

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

1. **Create** — create a new tournament: name, type (§4), games per
   match, points per game, and a checklist of all members to select as
   participants (each row shows photo/avatar, name, level for the active
   sport — this is the **only** place participants are ever chosen, per
   §4). A member with **no level yet in the active sport** (§3) appears
   disabled in this checklist, with an explanation that they need a level
   set on the Member tab first before they can be selected. On submit: the
   tournament and its participants are created, the first match is drawn
   immediately per the Match Generator (§5) and shown in a confirmation
   popup, and the organizer is taken directly into that tournament's
   Manage screen (tab 2's drill-down, below) — the new tournament also
   appears in tab 2's list automatically. The popup has an **Edit** action
   (§6) to swap out a drawn player before confirming, alongside Confirm.
2. **Active** — list of tournaments currently in progress. Each card:
   name, type, current round number (e.g. "Round 7" — there is no fixed
   total round count and therefore no round-progress fraction/bar).
   Tapping a card opens **Manage tournament** for it:
   - **Participants** — the tournament's roster (photo/avatar, name, level),
     each active row with a **Leave** button (§4) that opens a confirm
     dialog before the passphrase prompt, disabled while that participant
     is part of the Current match; participants who left show greyed out
     in the same list rather than a separate section. An **Add
     participant** entry point above/near the list opens a picker over the
     member pool (minus everyone already active on this tournament — which
     includes anyone who left, letting them be picked again to rejoin, §4)
     and goes straight to the passphrase prompt with no extra confirm.
     Both Leave and Add participant are hidden/disabled once the
     tournament is no longer active (ended or cancelled).
   - **Current match** — the two sides playing now, each side's name
     directly above its own score input (unambiguous which input belongs
     to which side), and a **Save result** button. Empty state ("No
     match in progress") when nothing is running.
   - **Next match** — independent of Current match, starts empty. A
     **Randomize** button draws the next pairing (§5) into this card —
     manually, on demand, for every match including the tournament's
     first one is drawn automatically at creation time per tab 1, but
     every match after that requires an explicit Randomize tap. The card
     also has an **Edit** action (§6) to swap out one or more drawn
     players inline before starting the match; an edited pairing is
     flagged as manually adjusted (visible later in History). Once a
     pairing exists here, a **Start match** button appears and moves it
     into Current match (replacing whatever was there, resetting score
     inputs), clearing Next match back to empty.
   - **Save result** opens a confirmation dialog (§6) before locking the
     result in; on confirm, it's appended to **Rounds played** (newest
     first, showing round label, both sides, winning side bolded/accented,
     final score), the round counter increments, and Current match
     returns to empty (Next match's pairing, if any, is not
     auto-promoted — the organizer must tap Start match).
   - **Cancel tournament** (danger-styled) — shown in place of End
     tournament, and only until the tournament's first match result is
     confirmed (§4). Opens a confirm dialog warning the action is
     permanent and can't be undone; on confirm, the tournament's status
     flips to **cancelled**, any drawn-but-unconfirmed match (Next or
     Current) is discarded, and the organizer returns to the Active tab
     (the tournament no longer appears there — it moves to History,
     below). Once a first result is confirmed, this action disappears
     permanently and End tournament takes its place, as below.
   - **End tournament** (danger-styled) opens a confirm dialog; on
     confirm the tournament's status flips to ended and the organizer
     lands on that tournament's Scoreboard (§7).
3. **Scoreboard** — the Overall Scoreboard (§8).
4. **History** — two sections, **by match** (every completed match
   across all tournaments, active or ended, newest first, same row
   format as Rounds played) and **by tournament** (every tournament —
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
- Multi-court scheduling and match-conflict detection.
- Persistent doubles "teams" as a first-class entity.
- Live, point-by-point scoreboard mode.
- Real player photo upload/storage — placeholder avatars only for now
  (§3).
- Any edit or admin-override path for a confirmed match result (§6).
- A dedicated "rejoin" UI distinct from Add participant — rejoining a
  participant who left reuses the same Add participant action (§4).
- Real-time/automatic re-draw of an in-progress Next match when a
  participant leaves — the draw is simply discarded, not regenerated
  (§4); the organizer taps Randomize again manually.
