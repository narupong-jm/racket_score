# IMPROVEMENT2.md — matchmaking, draw editing & history density

Status: concept, based on post-launch hands-on testing feedback (2026-07-31).
Read this after `IMPROVEMENT.md`/`SPEC.md`/`PLAN.md` — it's a **patch on top of
the shipped Phase 13 app**, not a new navigation overhaul. Scope is: (1) three
matchmaking algorithm corrections, (2) a manual override for drawn matches, and
(3) collapsible sections on the History tab.

Do not write implementation code yet. Enter Plan Mode first, propose the
concrete file/function changes below, and wait for approval before touching
`src/features/matchmaking/`, `src/features/matches/`, or `src/pages/HistoryPage.tsx`.

---

## 1. Matchmaking corrections

Current implementation lives in `src/features/matchmaking/` (pure TypeScript,
no React/Supabase — keep it that way). Three specific behaviors need to change.

### 1.1 Equal match-count fairness must be a hard bound, not just a preference

**Current behavior:** `selectCandidatePool.ts` builds the candidate pool by
taking players with the fewest matches played first, expanding to the next
tier only if the pool is still too small. This *tends toward* even match
counts but is never checked as an explicit invariant — nothing currently
verifies that, across a session, `max(matchesPlayed) - min(matchesPlayed) <= 1`
holds for all participants.

**Requested behavior:** the gap between the most-played and least-played
participant must never exceed 1, at every point in the tournament (not just
"eventually evens out").

**Action items:**

- Add an explicit invariant test in `selectCandidatePool.test.ts` (or a new
  test file) that simulates a full session of draws and asserts
  `max - min <= 1` holds after every single match, not just at the end.
- Audit whether the current tier-expansion logic can ever violate this when
  the pool size doesn't divide evenly by the needed player count (e.g. 5
  players left in the lowest tier but only 4 needed for doubles) — clarify
  what happens to the "left out" player's count relative to the rest.

### 1.2 Doubles must always be mixed when 2 male + 2 female are available

**Current behavior:** gender balance is currently a *tiebreaker*, not a hard
rule, in two places:

- `pickDoublesQuartet.ts` — picks the quartet with the smallest skill spread
  first, and only uses gender imbalance to break ties among quartets that are
  already tied on skill spread. A 3-male/1-female quartet could beat a 2-2
  quartet if its skill spread happens to be smaller.
- `splitIntoTeams.ts` — given a quartet, picks the split with the smallest
  skill-sum difference first, and only prefers mixed teams (`nonMixedTeamCount`)
  as the *second* priority. This means a male/male vs. female/female split can
  currently be chosen over a mixed split if it has a smaller skill-sum
  difference — exactly the case flagged in testing.

**Requested behavior:** whenever a quartet contains exactly 2 males and 2
females, the team split **must** be mixed (1 male + 1 female per team) —
this is not a tiebreak, it's a hard filter applied before skill-sum
comparison. Male/male vs. female/female must never be produced when a mixed
split is possible.

**Action items:**

- In `splitIntoTeams.ts`: when `nonMixedTeamCount` can be 0 for at least one
  candidate split, filter `candidates` down to only those splits **first**,
  before applying the skill-sum-diff comparison — i.e. swap the priority
  order so "must be mixed if possible" outranks "smallest skill-sum diff".
- Decide (and document in `SPEC.md`) what quartet selection should prioritize
  when the pool has both a 2-2 and an unbalanced option with similar skill
  spread — likely gender balance needs to move up in `pickDoublesQuartet.ts`'s
  priority order too, not just in the team-split step, so a 2-2 quartet is
  favored over a 3-1 quartet whenever both are reasonably close on skill.
- Update the matchmaking priority order documented in `README.md` /
  `docs/SPEC.md` to reflect that gender-mixing in doubles is now a
  correctness rule, not a soft preference.

### 1.3 Players in the Current match must not be redrawn into Next match

**Current behavior:** `useDrawInputs.ts` computes candidates and pairing
history from `getMatchHistory()`, which only queries `match_participants` for
matches where `status = 'completed'` (see `matchesApi.ts`). The in-progress
"Current match" (`status = 'queued'`, per `TournamentDetail.tsx`) is **not**
included in that query — so its participants' match counts aren't incremented
yet and nothing excludes them from being drawn again for "Next match" while
they're still on court.

**Requested behavior:** while a Current match is in progress, its participants
must be excluded from the Next-match candidate pool. The only exception is
when there genuinely aren't enough other players to fill Next match — in that
case, a currently-playing player may be reused (a player physically can't play
two courts at once, so in practice this only matters if the venue model ever
allows more than one court, but the constraint should still be enforced at the
draw level, not assumed away).

**Action items:**

- Pass the Current match's participant IDs into `generateNextMatch` (or filter
  them out of `drawInputs.candidates` before calling it) at the call site in
  `TournamentDetail.tsx`'s `handleRandomize`.
- Add a fallback: if excluding current-match players drops the pool below
  `getNeededPlayerCount(type)`, fall back to including them (with a visible
  note/warning in the UI, since this is the "not enough players" escape
  hatch) rather than silently returning `not_enough_players` when a
  perfectly fine draw exists that reuses someone already on court.
- Add a test asserting that, given a valid Current match, `generateNextMatch`
  never returns a Next match sharing a player with it unless the fallback
  condition is met.

---

## 2. Manual edit of a drawn match (both initial draw and Next match)

**Current behavior:** the tournament's first match is auto-drawn at creation
time (with a confirmation popup), and subsequent matches are drawn into
"Next match" via the Randomize button, then promoted to "Current match" via
"Start match". There is no way to change who's in a drawn-but-not-yet-started
match if the algorithm's pick doesn't make sense on the day (e.g. someone
stepped out, or the organizer wants to override for a reason the algorithm
can't see).

**Requested behavior:** add an **Edit** action on both:

- the confirmation popup shown for the tournament's auto-drawn first match, and
- the "Next match" card in the Manage Tournament screen (Active tab drill-in).

Edit lets the organizer swap out one or more of the drawn players for someone
else from the tournament's participant pool, before the match starts. Once a
match is promoted to "Current match" and started, existing rules still apply
(no edit after confirmation of a *result* — that's unrelated and stays
locked, per `docs/SPEC.md`). Editing a *not-yet-started* draw is a new,
narrower capability — the match hasn't happened yet, so there's no "result"
to protect.

**Open questions to resolve in planning, not here:**

- Does editing the first-match popup re-run gender/skill validation (e.g.
  should the UI warn if the manually-edited lineup violates the 1.2 mixed-
  doubles rule), or is manual override allowed to bypass it entirely?
- Does an edited Next match get flagged/remembered as "manually adjusted" for
  transparency (e.g. in History), or is it indistinguishable from an
  algorithm-drawn match once started?
- UI affordance: inline edit (tap a player's name, pick a replacement) vs. a
  separate edit screen — needs a mockup before implementation.

---

## 3. History tab: collapsible sections, collapsed by default

**Current behavior:** `src/pages/HistoryPage.tsx` renders two always-expanded
sections stacked vertically: `ByMatchSection` (recent completed matches) and
`ByTournamentSection` (links into each tournament's scoreboard). Viewing one
section requires scrolling past all of the other.

**Requested behavior:** each section gets a show less / show more toggle in
its header (top-right of the section heading). Both sections default to the
**collapsed ("show less")** state — the organizer opts in to scrolling through
history rather than it being forced on page load.

**Action items:**

- Add local component state (`useState<boolean>`, no need to persist across
  navigations/reloads unless later requested) to `ByMatchSection` and
  `ByTournamentSection` independently — each toggles on its own, not as a pair.
- Decide what "collapsed" shows: nothing but the heading + toggle, or a small
  peek (e.g. first 1-2 items) — needs a call before implementation; simplest
  default is heading-only when collapsed.
- Toggle button placement: top-right of each `<h2>`, per the request — likely
  needs a small flex-header wrapper class in `index.css` rather than relying
  on the current plain `<h2>{t(...)}</h2>`.
- i18n: add `history.showMore` / `history.showLess` keys to both `en.json` and
  `th.json`.
- Add/update `HistoryPage.test.tsx` to cover: default collapsed state, toggle
  expands, toggle collapses again, and that the two sections' states are
  independent of each other.

---

## 4. Suggested sequencing

These three items don't depend on each other and can land as separate PRs/
commits:

1. **§1 (matchmaking corrections)** — highest risk, touches the most heavily
   tested module in the codebase; do this first and in isolation so the
   existing `matchmaking/*.test.ts` suite plus new invariant tests catch
   regressions before §2 builds UI on top of the same draw path.
2. **§3 (History collapse)** — lowest risk, pure UI/state, no schema or
   algorithm changes. Good to do independently, any time.
3. **§2 (manual edit)** — depends on §1 being settled first, since editing UI
   needs to know whether/how to validate an edited lineup against the
   corrected matchmaking rules.
