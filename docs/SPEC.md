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

## 1. Overview

A web app for running badminton "battle" sessions using **balanced random
matchmaking** — not a fixed round-robin bracket where every pair must meet
exactly once, but a generator that draws one match at a time based on
fairness rules. Includes a central player pool with cross-tournament
history/stats and standings within each tournament.

## 2. Technology & Hosting

- **Frontend:** React
- **Backend/Database:** Supabase (new project, created for this app)
- **Deployment:** Vercel
- **No authentication / login system.** Anyone can create tournaments,
  add players, generate matches, and record scores. This is an intentional
  simplification for private/trusted use; access control (e.g. edit vs.
  view links, or real auth) is a future enhancement, not part of this spec.
- **UI language:** Thai and English, switchable in-app.

## 3. Player Pool (central, persistent)

- Players are created once in a shared pool and reused across tournaments.
  Cross-tournament history/stats are tracked per player.
- Fields: **name, gender, skill level**. A photo is displayed everywhere a
  player/member is listed (member list, tournament participant checklist,
  scoreboards), but for now this is always a **generated placeholder
  avatar** (initials + a color derived from the name) — there is no photo
  upload capability or `photo`/`avatar_url` column in this phase. Real
  upload (Supabase Storage) is explicitly deferred (see Out of scope).
- **Skill level:**
  - New players (fewer than 3 recorded matches, tournament or otherwise)
    self-select an initial level: `Beginner / Intermediate / Advanced / Pro`.
  - Once a player has **3 or more** recorded matches, their level is
    computed automatically from their **win rate** and displayed instead
    of the self-selected value, using fixed win-rate bands (app-defined
    defaults) mapped to the same four categories.
- **Doubles pairs are never persisted as a standing entity.** Every
  tournament re-pairs players from the individual pool; there is no
  reusable "team" object.

## 4. Tournaments

- A tournament is **one match type only**: singles OR doubles, chosen at
  creation. Running both requires two separate tournaments.
- Per-tournament scoring configuration (set at creation):
  - Number of games per match (e.g. best of 1, best of 3, ...)
  - Target points per game (e.g. 15 / 21 / 25, organizer-defined)
  - Deuce rule: must win by 2 points, capped at a ceiling scaled to the
    target (mirrors BWF's 21-point-target/30-cap ratio). Score entry is
    validated against this rule.
- **Participants are selected once, at creation time, from the member
  pool — and only then.** There is no way to add a player to an
  in-progress tournament; the participant list is fixed for the
  tournament's lifetime. (This reverses an earlier draft of this spec,
  which allowed late joins — the organizer now finalizes the roster
  before the first match is drawn.)
- **Single court**: matches are played one at a time. The system does not
  need to track concurrent in-progress matches across multiple courts,
  though the organizer can pre-generate the next match into a queue while
  the current one is still being played.
- Tournament ends when the **organizer manually stops it** — there is no
  fixed number of matches or rounds decided in advance.

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
Next match — a player can't be drawn again while still on court. If
excluding them would leave too few players to fill Next match, they may be
reused as a fallback, with a visible warning in the UI that this happened.

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
2. **Point differential** (total points scored minus conceded) —
   tiebreaker.

Each row shows: photo/avatar, name, matches played, matches won, point
differential, win rate. Ranks 1–3 get a medal icon instead of a plain
number.

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
2. **Point differential** — tiebreaker, same aggregation scope.

Each row shows: photo/avatar, name, matches played, matches won, **total
points scored** (cumulative points scored across all their matches — not
a differential), win rate. Ranks 1–3 get a medal icon.

**Filters**, two independent, freely-combinable groups:
- **Period**: All time / This month (calendar month, i.e. matches
  completed since the 1st of the current month).
- **Match type**: All / Singles / Doubles (a player's doubles-tournament
  matches vs. singles-tournament matches).

All displayed columns (matches played/won, points, win rate) recompute
for the active period × type combination, not just the win-rate sort.

## 9. Application Flow (Navigation & Pages)

The app uses a 5-tab bottom navigation bar, always visible, present at
every screen size (not a responsive top-nav on wider viewports):

1. **Create** — create a new tournament: name, type (§4), games per
   match, points per game, and a checklist of all members to select as
   participants (each row shows photo/avatar, name, level — this is the
   **only** place participants are ever chosen, per §4). On submit: the
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
   - **End tournament** (danger-styled) opens a confirm dialog; on
     confirm the tournament's status flips to ended and the organizer
     lands on that tournament's Scoreboard (§7).
3. **Scoreboard** — the Overall Scoreboard (§8).
4. **History** — two sections, **by match** (every completed match
   across all tournaments, active or ended, newest first, same row
   format as Rounds played) and **by tournament** (every tournament,
   active and ended; tapping one opens its per-tournament Scoreboard,
   §7). Each section has its own show more / show less toggle in its
   heading (top-right), independent of the other; both default to
   **collapsed** (heading only — no peek of items) so the organizer
   opts in to scrolling through history rather than it being forced on
   page load.
5. **Member** — the central player pool: an "add member" form (name,
   gender as an icon-toggle, level as a dropdown, no photo upload per
   §3) above a list of all current members (photo/avatar, name, level).
   This tab is **only** for managing the member pool — it has no
   tournament-participation controls (see §4's create-time-only rule).

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
- Adding a participant to a tournament after it has started (§4).
