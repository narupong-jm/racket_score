# Badminton Battle & Scoreboard App — Specification

Confirmed: 2026-07-30

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
- Fields: **name, gender, skill level**.
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
- **Players can be added to an in-progress tournament at any time.** New
  entrants start at 0 matches played and immediately join the fairness
  pool for future draws.
- **Single court**: matches are played one at a time. The system does not
  need to track concurrent in-progress matches across multiple courts,
  though the organizer can pre-generate the next match into a queue while
  the current one is still being played.
- Tournament ends when the **organizer manually stops it** — there is no
  fixed number of matches or rounds decided in advance.

## 5. Match Generator (balanced random draw)

Organizer clicks a button to draw one match at a time (can queue the next
match in advance). Selection priority, in order:

1. **Equal match count** — prefer players who have played the fewest
   matches so far in this tournament.
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

## 6. Match Result Recording

- Results are entered **after the match ends** as a summary per game
  (e.g. `21-15`, `18-21`, `21-19`) — no live point-by-point scoring.
- Entered scores are validated against the tournament's configured
  scoring rules (target points, win-by-2, cap).

## 7. Standings / Ranking

Within a tournament, players are ranked by:

1. **Total games won** (cumulative across all their matches) — primary.
2. **Point differential** (total points scored minus conceded) — tiebreaker.

## Out of scope / explicitly deferred

- Real-time push updates (viewers refresh manually or on a polling
  interval — no live sync requirement).
- Authentication, roles, or per-tournament edit/view link separation.
- Multi-court scheduling and match-conflict detection.
- Persistent doubles "teams" as a first-class entity.
- Live, point-by-point scoreboard mode.
