# IMPROVEMENT3.md — mid-tournament roster changes (leave / late join)

Status: concept, based on real-world session feedback (2026-08-07). Read this
after `IMPROVEMENT.md`/`IMPROVEMENT2.md`/`SPEC.md`/`PLAN.md`. This patch adds
two new participant-roster actions to an **in-progress** tournament: letting a
participant drop out, and letting the organizer add a late arrival. Both are
new capabilities on the Manage Tournament screen's existing Participants
section (`TournamentDetail.tsx`, ~line 156-173).

**This patch explicitly reverses a prior deliberate decision.** `docs/SPEC.md`
§4 states: *"Participants are chosen once, at tournament-creation time, from
the member pool — never after... There is no way to add a player to an
in-progress tournament... which allowed late joins — the organizer now
finalizes the roster [at creation]."* §2 of this document (late join)
un-deletes that feature, with different fairness semantics than the old one
had. Treat this as a conscious reversal to record in `SPEC.md`, not an
oversight.

Do not write implementation code yet. Enter Plan Mode first, propose the
concrete schema/file changes below, and wait for approval before touching
`src/features/tournaments/`, `src/features/matchmaking/`, or the Supabase schema.

---

## 0. Schema gap

`tournament_participants` currently has only three columns (per
`database.types.ts`): `tournament_id`, `player_id`, `joined_at`. Neither of
this patch's two features can be built without adding columns:

- A **status** column (e.g. `status text not null default 'active'`, values
  `'active' | 'left'`) to support §1 (soft-remove, reversible, per decision
  below).
- A **fairness offset** column (e.g. `match_count_offset integer not null
  default 0`) to support §2's "count as if already played N matches" rule.

Both need a migration plus a `database.types.ts` regeneration
(`generate_typescript_types`). RLS policies on `tournament_participants`
already gate writes via the Phase 16 passphrase mechanism (see
`addParticipant()` in `tournamentsApi.ts`, which threads a `passphrase`
argument through) — new mutations here should follow the same pattern, not
introduce a new access path.

---

## 1. Leave tournament (per-participant, mid-tournament)

**Problem:** a participant who leaves early (e.g. goes home) stays in the
draw pool, so `generateNextMatch` can still pick them for a match they'll
never show up for.

**Decided behavior:**

- **Soft-remove, reversible.** Set `tournament_participants.status = 'left'`
  rather than deleting the row. Nothing in History/Scoreboard changes —
  those read from `match_participants`/completed matches, which are
  untouched. A later "rejoin" action (not required by this patch, but the
  soft-flag design leaves room for one) stays possible.
- **Excluded from the draw pool immediately.** `useDrawInputs.ts`'s
  `assembleDrawInputs()` builds `candidates` from `listParticipants()` — that
  query (or the mapping step) needs to filter to `status = 'active'` only.
- **Blocked while the participant is in the Current match.** The "Leave"
  button/action must be disabled for a participant who is one of the Current
  match's participants (`currentMatch.status === 'queued'` per
  `TournamentDetail.tsx`'s existing `currentMatch` lookup) — they must finish
  or the match must resolve before they can be marked as left. This avoids an
  ambiguous "walked off mid-game" state the app has no way to represent in a
  match result.

**Action items:**

- Migration: add `status` column to `tournament_participants` (default
  `'active'`), backfill existing rows.
- New mutation (mirroring `useAddParticipant`'s passphrase-gated pattern):
  `useLeaveTournament` / `leaveParticipant(tournamentId, playerId,
  passphrase)` → `UPDATE tournament_participants SET status = 'left' WHERE
  ...`.
- `listParticipants()` / `useDrawInputs.ts`: filter candidates to active
  participants only. Decide whether `listParticipants()` itself filters, or
  returns all rows and callers filter — the Participants section in
  `TournamentDetail.tsx` likely still wants to show "left" participants
  (e.g. greyed out) rather than hide them entirely, so filtering probably
  belongs in the *draw* path (`useDrawInputs.ts`), not the roster-display path.
- UI: add a "Leave" button per row in the existing Participants list
  (`TournamentDetail.tsx` ~line 162-170). Disabled state when
  `participant.player_id` is one of `currentMatch`'s participants. Add a
  confirm step (this is a write action, so it goes through the passphrase
  gate already — decide if an *additional* "are you sure" dialog is needed
  on top, consistent with how `Cancel Tournament` and `endTournament` already
  confirm before the passphrase prompt).
- i18n keys for the button, disabled-state tooltip/reason, and any confirm
  dialog copy.
- Tests: `useDrawInputs`/`selectCandidatePool` integration test asserting a
  `'left'` participant never appears in `candidates`; UI test asserting the
  Leave button is disabled for a Current-match participant.

---

## 2. Add late-arriving participant (mid-tournament)

**Problem:** someone who arrives after the tournament has started has no way
to join — they're not in the original roster picked at creation time.

**Decided behavior:**

- Reuses `useAddParticipant` (already exists, already passphrase-gated,
  already invalidates `drawInputs`) as the entry point — this patch adds a
  UI affordance to call it *after* creation, not just from
  `CreateTournamentForm`, plus the offset logic below.
- **Fairness offset, not real match count.** On add, compute `offset =
  min(matchesPlayedInTournament)` across all currently **active**
  participants at that moment, and store it as
  `tournament_participants.match_count_offset` for the new participant. This
  uses the *minimum*, matching the existing hard "gap ≤ 1" invariant from
  `IMPROVEMENT2.md` §1.1 — a late joiner starts level with whoever's
  currently furthest behind, not the average or the leader.
- **Offset only affects the draw.** `useDrawInputs.ts`'s
  `assembleDrawInputs()` currently computes `matchesPlayedInTournament` purely
  from completed-match history (`matchCountByPlayer`). For candidates with a
  nonzero `match_count_offset`, the value fed into
  `CandidatePlayer.matchesPlayedInTournament` (matchmaking's fairness input)
  must be `realCompletedCount + offset`. The *display* value (UI counters,
  Scoreboard, win rate) must stay the real completed count — offset is
  invisible outside the draw algorithm's internal calculation, per the
  explicit instruction that a late joiner "should not get credit for games
  they didn't actually play" in win-rate/scoreboard terms.
- No retroactive fairness attempt — the offset does not try to make the late
  joiner "catch up" faster; it just prevents the algorithm from *also*
  penalizing them for arriving late by comparing raw match counts.

**Action items:**

- Migration: add `match_count_offset` column to `tournament_participants`
  (default `0` — existing/normal participants are unaffected since they
  join at creation when the offset is trivially 0 for everyone).
- `addParticipant()` in `tournamentsApi.ts`: extend to accept and persist an
  `offset` value; compute it at the call site (needs the current
  `matchesPlayedInTournament` per active participant, which
  `useDrawInputs`/`assembleDrawInputs` already derives — the "add participant"
  UI flow needs access to the same derived data before submitting).
- `assembleDrawInputs()` in `useDrawInputs.ts`: when building each
  `CandidatePlayer`, add `match_count_offset` (fetched via
  `listParticipants()`) to the real completed-match count for that
  fairness-facing field only.
- UI: an "Add participant" entry point on the Manage Tournament screen
  (near/in the Participants section), presenting the member pool minus
  players already on this tournament's active roster, reusing whatever
  player-picker component `CreateTournamentForm` already uses for the
  creation-time checklist if one exists as a shared component.
- Tests: unit test on the offset-computation function (given active
  participants at various match counts, offset = min); integration test that
  a freshly-added participant's `matchesPlayedInTournament` used by
  `generateNextMatch` equals `0 + offset`, while their Scoreboard/win-rate
  figures (via `player_stats`/`tournament_standings` views) reflect `0`
  real matches until they actually play.

---

## 3. Interaction with IMPROVEMENT2.md (already implemented — verified 2026-08-07)

Both features in this document sit directly on top of the fairness mechanics
`IMPROVEMENT2.md` §1.1 (hard equal-match-count bound) and §1.3
(current-match exclusion) describe. Contrary to an earlier draft of this
note, both are **already implemented and tested**, as Phase 14 in
`docs/PLAN.md` (all steps `[x]`), shipped well before this document was
written:

- §1.1: `selectCandidatePool.ts` returns `mandatoryIds`; `pickSinglesPair.ts`/
  `pickDoublesQuartet.ts` filter on it; `fairnessInvariant.test.ts` asserts
  `max(matchesPlayed) - min(matchesPlayed) <= 1` after every match across
  multi-round singles/doubles sessions, including pool sizes that don't
  divide evenly by the needed player count.
- §1.3: `TournamentDetail.tsx`'s `handleRandomize` filters
  `currentMatchParticipantIds` out of `drawInputs.candidates` before calling
  `generateNextMatch`, falling back to the unfiltered pool (with a UI
  warning, `manage.currentMatchReusedWarning`) only when too few other
  players remain. Covered by two `TournamentDetail.test.tsx` cases
  (exclusion, and fallback-with-warning).

This means this document's offset math can safely assume the "gap ≤ 1" bound
already holds exactly, and its "leave" filtering shares the same
candidate-pool code path as the already-shipped current-match exclusion fix
— no prerequisite work remains before starting on §1/§2 below. Recommended
sequencing:

1. Implement this document's §1 (leave) and §2 (late join) directly on top of
   the existing fairness core, defining `matchesPlayedInTournament` (real vs.
   offset-adjusted) as described in §2 above.
2. `IMPROVEMENT2.md` §2 (manual draw edit) and §3 (History collapse) are also
   already implemented (Phase 14, steps 4-9) and don't block this document's
   work either way.

---

## 4. Open items to confirm during planning (not blocking this summary)

- Exact button/label copy and confirm-dialog wording (i18n, both `en.json`
  and `th.json`).
- Whether `listParticipants()` should filter `status = 'active'` by default
  with an explicit `includeLeft` flag for the roster-display call site, or
  the other way around — an implementation detail to settle when touching
  the code, not a product decision.
- Whether leaving/adding participants should be blocked entirely once the
  tournament has ended (`endTournament`/`cancelTournament` already exist per
  Phase 15/16) — almost certainly yes, but should be an explicit guard, not
  an assumption.
