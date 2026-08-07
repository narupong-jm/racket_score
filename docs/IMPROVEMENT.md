# IMPROVEMENT.md — racket-score UI/UX overhaul

Status: mockup-approved concept, ready for planning. Read this file, then update
`SPEC.md`, `PLAN.md`, and `CLAUDE.md` to reflect it before writing any code.
This is a **navigation and flow redesign**, not just a visual restyle — it changes
how many screens the app has and how tournaments get managed. Treat it as a new
phase, not a patch on Phase 13.

Do not write implementation code yet. Enter Plan Mode first, propose the file/
component changes and the updated SPEC/PLAN structure, and wait for approval.

---

## 0. Removed functionality

- **Drop**: "Add player who arrives late" mid-tournament flow. Players must be
  selected from Members at tournament creation time only.

---

## 1. Navigation structure

Bottom tab bar, 5 tabs, in this order:

| #   | Tab        | Icon idea | Purpose                                |
| --- | ---------- | --------- | -------------------------------------- |
| 1   | Create     | plus      | Create a new tournament                |
| 2   | Active     | list      | Tournaments currently in progress      |
| 3   | Scoreboard | trophy    | Overall ranking across all matches     |
| 4   | History    | clock     | Past matches and completed tournaments |
| 5   | Member     | people    | Add new members + view member list     |

A tournament's live scoreboard (scoped to one tournament) is **not** a tab — it's
reached by drilling in from Active (mid-tournament) or History (after it ends).

---

## 2. Page: Create tournament

Fields:

- **Name** (text)
- **Type** — icon-toggle buttons, not a dropdown: Singles / Doubles
- **Games per match** (number)
- **Points per game** (number)
- **Select players** — checklist of all Members. Each row must show all three:
  **photo (or avatar placeholder), name, level**. No name-only rows.

Submit button: "Create tournament".

**On successful create → navigate to the Active tab**, with the new tournament
appearing in the active list. This is the one required cross-screen behavior:
creating a tournament is how it becomes "active."

---

## 3. Page: Active tournaments

- List of tournaments currently in progress (not yet ended).
- Each item is a card: name, type, round progress (e.g. "Round 7 of 10"), a
  progress bar, and a chevron.
- Tapping a card opens **Manage tournament** (section 4) for that tournament.
- No tournaments in progress → empty state, plain text, no apology tone
  ("No active tournaments" not "Nothing here yet").

---

## 4. Page: Manage tournament

This is the core of the rework. Reached only from Active → tap a tournament.

### 4.1 Current match (card, top)

- Shows the two sides currently playing, **team/player names placed directly
  above their own score input** — this is a hard requirement, not cosmetic:
  the layout must make it unambiguous which input belongs to which side.
- Two number inputs (one per side) for the live score.
- **Save result** button.
- If no match has been started yet (fresh tournament, or right after a result
  was confirmed), this card shows an empty state — "No match in progress —
  start the next match below" — instead of stale scores.

### 4.2 Next match (card, directly below Current match, above Rounds played)

- Independent from Current match. Starts **empty** ("Not picked yet") until
  the user acts.
- **Randomize** button: generates the next pairing using the matchmaking
  rules already defined in `SPEC.md` (fairness/rotation/whatever constraints
  are specified there — do not invent new matchmaking logic here, reference
  the existing spec). Result appears in this card, not in Current match.
- Once a pairing exists here, a **Start match** button appears alongside
  Randomize (user can still re-randomize before starting).
- **Start match**: moves this pairing into the Current match card (replacing
  whatever was there), resets the score inputs to 0, and clears Next match
  back to its empty state.

### 4.3 Save result → confirm dialog (hard requirement)

Clicking **Save result** must **not** save immediately. It opens a confirm
dialog:

- Shows the two side names and the entered score for review.
- Copy: something like "Confirm this result? It can't be edited after."
- Two actions: **Cancel** (closes dialog, no change) and **Confirm result**
  (locks it in).
- On confirm: the match is appended to **Rounds played** (below, newest on
  top), the round counter increments, and Current match returns to its empty
  state. Once confirmed, this result is **not editable** — no edit affordance
  should exist for locked rounds.

### 4.4 Rounds played (list, below the two cards above)

- Reverse-chronological list of completed rounds in this tournament.
- Format matches the reference screenshot: round label (R1, R2…), both team
  names separated by "vs", **winning side bold with an accent color**, score
  at the end.

### 4.5 End tournament

- Button at the bottom, danger-styled (not the same visual weight as primary
  actions).
- Clicking it does **not** end the tournament immediately — it opens a confirm
  dialog: "End this tournament? Results can't be changed after, and you'll be
  taken to its final scoreboard." Cancel / Confirm end.
- On confirm: tournament status flips to ended, and the user is navigated to
  that tournament's scoped scoreboard (section 5.2).

---

## 5. Page: Scoreboard

Two contexts share the same visual design, different data scope.

### 5.1 Overall scoreboard (tab 3)

- Ranked by win rate, high to low, computed across **all matches, all
  tournaments**.
- Filter control at the top — segmented buttons: All time / This month /
  Singles / Doubles (adjust exact filter set to what's feasible from the data
  model; the point is period + match-type filtering, confirm exact filters
  with the user before finalizing).
- Each row must show: **photo (or avatar), name, matches played, matches won,
  total points, win rate.**
- Ranks 1–3 get a medal/award icon (gold/silver/bronze) instead of a plain
  number. Rank 4+ shows a plain number.

### 5.2 Per-tournament scoreboard

- Same visual layout and same required columns as 5.1, but **scoped to a
  single tournament's matches only**.
- Reached by: (a) tapping a tournament under History → "By tournament", or
  (b) automatically after confirming "End tournament" in Manage tournament.
- No filter bar needed here (the tournament itself is the scope).

---

## 6. Page: History

Two sections, both always visible on this tab (not sub-tabs).

### 6.1 By match (top section)

- Reverse-chronological list of individual matches across all tournaments.
- Per the reference screenshot: round label, both sides separated by "vs",
  **winning side bold with an accent color**, score at the end.

### 6.2 By tournament (bottom section)

- List of tournaments (active and ended). Each row: name, type, chevron.
- Tapping a row opens that tournament's scoped scoreboard (section 5.2).

---

## 7. Page: Member

Single page, two parts.

### 7.1 Add member (top)

- This page is **only** for adding new members — no in-tournament "add late
  player" flow (see section 0).
- Fields: **Name**, **Gender** (icon-toggle, not dropdown), **Level**
  (dropdown is fine here), **Photo** (optional upload, placeholder avatar if
  none).
- "Add member" submit button.

### 7.2 Current members (bottom, below the form)

- Table/list of all existing members.
- Each row must show all three: **photo (or avatar placeholder), name,
  level**.

---

## 8. Open questions to resolve during planning (do not guess silently)

1. **Overall scoreboard filters** — confirm exact filter set (period options,
   whether type filter is Singles/Doubles or something else) against the real
   data model before implementing.
2. **Randomize constraints** — confirm this reads the matchmaking rules
   already in `SPEC.md` rather than re-deriving them here.
3. **Rounds played editability** — confirm there is genuinely no edit path for
   a confirmed result anywhere in the app (e.g. admin override), or whether
   that's intentionally out of scope for this phase.

---

## 9. What this does NOT change

- Supabase schema/queries, matchmaking algorithm internals, auth, and
  deployment config are out of scope for this phase — pure UI/flow/navigation
  rework built on top of Phase 13's card/layout foundation.
