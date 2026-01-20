# Corner Betting

## Overview

Add support for betting on corners - both match total corners and team-specific corner lines.

## Data Availability

- **Fixture stats**: `TeamStats` in `fixtures.ard` already tracks `corners: Int` per team per match
- **Odds**: API-Football provides corner odds via the existing odds endpoint

## Implementation

### 1. Add Bet Type IDs

In `odds.ard`, add constants for corner bet types:

```ard
let MATCH_CORNERS = ???       // Total match corners over/under
let HOME_CORNERS = ???        // Home team corners over/under
let AWAY_CORNERS = ???        // Away team corners over/under
```

Note: Need to look up the actual bet type IDs from API-Football documentation.

### 2. Extend Snapshot with Corner Stats

In `predictions.ard`, add corner-related fields to `Snapshot`:

```ard
struct Snapshot {
  // ... existing fields ...

  corners_for: Int,           // Total corners won
  corners_against: Int,       // Corners conceded to opponents
  corners_per_game: Float,    // Average corners per game
  corners_against_per_game: Float,
}
```

### 3. Update get_form() to Calculate Corner Stats

Aggregate corner data from fixture stats when building the Snapshot.

### 4. Add Picking Function

Create `pick_corner_lines()` similar to `pick_team_goal_lines()`:

```ard
fn pick_corner_lines(odd: odds::Stat, home: Snapshot, away: Snapshot, mut entry: FixturePicks) {
  // For match totals: combine both teams' corner averages
  // For team lines: use individual team's corner stats

  // Thresholds TBD - will need refinement based on data analysis
}
```

### 5. Update find_juice()

Add corner bet types to the odds processing loop:

```ard
if odd.id == odds::MATCH_CORNERS {
  pick_corner_lines(odd, comp.home, comp.away, entry)
}
if odd.id == odds::HOME_CORNERS {
  pick_team_corner_lines(odd, comp.home, entry)
}
if odd.id == odds::AWAY_CORNERS {
  pick_team_corner_lines(odd, comp.away, entry)
}
```

### 6. Update Bet Resolution

In `bets.ard`, add corner bet resolution in `process_bet()`. This will require:
- Fetching fixture stats to get actual corner counts
- Comparing against the bet line

## Open Questions

- [ ] Look up exact bet type IDs from API-Football for corner markets
- [ ] Determine initial thresholds for picking corner bets (e.g., "Over 9.5 if combined average > 10")
- [ ] Decide if we need corner stats in the matchup page UI

## Files to Modify

- `api/server/odds.ard` - Add bet type constants
- `api/server/predictions.ard` - Extend Snapshot, add picking logic
- `api/server/bets.ard` - Add corner bet resolution
- `api/server/fixtures.ard` - May need to ensure corner stats are properly aggregated

## Impact

Medium - requires changes across multiple modules but follows existing patterns for goal-based bets
