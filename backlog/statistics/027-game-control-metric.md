# Game Control Metric

## Overview

Develop a "game control" or "field tilt" proxy metric based on available data, inspired by Opta's Field Tilt. The goal is to quantify how much a team dominates territorially and creates attacking pressure, independent of actual goals scored.

## Motivation

When manually analyzing matchups, game control is a mental factor - a team that consistently pins opponents back, takes corners, and creates chances is "controlling" games even if they're not clinical finishers. Surfacing this would:

1. Aid manual matchup analysis
2. Potentially factor into automated picking logic
3. Provide another dimension for ranking teams in a league
4. Help evaluate "strength of opposition" - good stats against weak opponents vs strong ones

## Available Data

From `TeamStats` (per fixture):

| Category | Fields |
|----------|--------|
| Attacking | `shots`, `shots_in_box`, `shots_out_box`, `shots_on_goal`, `corners`, `xg` |
| Territorial | `possession`, `passes`, `passes_completed` |
| Pressure | `offsides` (attacking intent), opponent's `goals_prevented` |

## Potential Approaches

### 1. Simple Composite Score

Weighted combination of key indicators:

```
game_control = (
  shots_in_box * W1 +
  corners * W2 +
  possession * W3 +
  pass_accuracy * W4 +
  xg * W5
)
```

Weights could be tuned via backtesting correlation with outcomes.

### 2. Relative Control (vs Opponent)

For matchup analysis, express as a ratio or difference:

```
control_ratio = team_control / opponent_control
control_diff = team_control - opponent_control
```

A team with `control_ratio > 1.5` is dominating territorially.

### 3. League Percentile Ranking

Rank all teams in a league by game control score. Useful for:
- Quick comparison: "Team A ranks 3rd in game control, Team B ranks 15th"
- Strength of schedule: "Team A's opponents average 12th in game control"

### 4. Control vs Conversion Split

Separate metrics to capture the nuance:
- **Game Control**: territorial dominance (corners, possession, shots)
- **Conversion Rate**: finishing quality (goals / xG, or goals / shots_in_box)

A team with high control but low conversion is a specific profile - good for certain bets (corners over, opponent cleansheet no) but maybe not goal overs.

## Use Cases

### Matchup UI
Display game control comparison:
```
         Home    Away
Control:  72%     28%    ← Home team dominates territorially
xG/game:  1.8     1.2
Corners:  6.2     3.1
```

### Automated Picking
Factor into picks:
- If team has high control but low conversion → lean corner overs
- If team has low control but high conversion → counter-attacking style, different profile

### League Rankings
New view showing teams ranked by game control, conversion rate, etc.

### Strength of Schedule
"Team A has played opponents averaging 8th in game control" - contextualizes their stats.

## Open Questions

- [ ] What weights produce the most predictive composite score?
- [ ] Should this be per-game or aggregated over form window (last 5)?
- [ ] How to handle teams with very different styles (possession-based vs counter-attacking)?
- [ ] Is there correlation between game control differential and match outcomes?
- [ ] Should it be normalized by league? (Different leagues have different styles)

## Implementation Phases

**Phase A: Calculation & Storage**
- Add `game_control` field to `Snapshot` or create new `ControlMetrics` struct
- Calculate during form aggregation

**Phase B: UI Surfacing**
- Display in matchup page
- Add to team performance view

**Phase C: Picking Integration**
- Use as factor in `find_juice()` logic
- Backtest to validate predictive value

**Phase D: League Rankings**
- New endpoint/view for league-wide control rankings
- Strength of schedule calculations

## Files to Modify

- `api/server/predictions.ard` - Add to Snapshot or new struct
- `api/server/analysis.ard` - League-wide calculations
- `web/src/components/matchup/stat-comparison.tsx` - Display in UI
- Potentially new `api/server/control.ard` module if complex

## Impact

Medium - Exploratory feature that could provide significant analytical value. Start with calculation and UI surfacing, then evaluate whether to integrate into picking logic.
