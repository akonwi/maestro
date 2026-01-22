# Venue-Filtered Stats (Home/Away Splits)

## Overview

Add home/away performance splits to the matchup stats endpoint, enabling contextual analysis where the home team's home-only stats are compared against the away team's away-only stats.

## Motivation

Currently, the matchup page shows overall season stats for both teams. But for betting analysis:
- The home team will be playing **at home** - their home record is more predictive
- The away team will be playing **away** - their away record is more predictive

Showing contextual stats (home team's home performance vs away team's away performance) provides more relevant signal than overall averages.

## Current State

| Endpoint | Data | Home/Away Split? |
|----------|------|------------------|
| `/matchup/:id/stats` | `Snapshot` (rich stats) | No |
| `/teams/:id/performance` | Basic stats | Yes |
| `/teams/:id/metrics` | Shots/xG/corners | No |

The performance endpoint has splits but lacks xGF, xGA, strike_rate, etc.
The matchup endpoint has rich stats but no splits.

## Proposed Solution

### API Response Change

Update `/matchup/:id/stats` to return venue splits for season data:

```json
{
  "season": {
    "home": {
      "overall": Snapshot,
      "home_only": Snapshot,
      "away_only": Snapshot
    },
    "away": {
      "overall": Snapshot,
      "home_only": Snapshot,
      "away_only": Snapshot
    }
  },
  "form": {
    "home": Snapshot,
    "away": Snapshot
  }
}
```

Notes:
- Form (last 5) stays as overall stats - sample size too small for venue splits
- Season splits are meaningful over 15+ games

### Backend Implementation

Modify `predictions.ard` to support venue filtering when fetching stats from API-Football:

1. Fetch team's played fixtures via `fapi::get_team_played_fixtures()`
2. Filter by venue (home_id == team_id or away_id == team_id)
3. Compute `Snapshot` from filtered fixtures

**Prerequisite**: Rate limit handling in `fapi.ard` (completed) ensures reliable API calls.

### Frontend Implementation

Add a "Contextual / Full" toggle on the matchup page (Season tab only):

```
Season selected:
┌──────────────────────────────────────────┐
│  [Season]  [Last 5]    [Contextual ▼]    │
└──────────────────────────────────────────┘

Last 5 selected (no toggle):
┌──────────────────────────────────────────┐
│  [Season]  [Last 5]                      │
└──────────────────────────────────────────┘
```

**Contextual view** (default):
- Home team's `home_only` stats
- Away team's `away_only` stats
- Most predictive for the actual matchup

**Full view**:
- Complete home/away/total breakdown table for both teams
- Similar to team stats page layout

## Files to Modify

**Backend:**
- `api/server/predictions.ard` - Add venue-filtered snapshot calculation
- `api/server/main.ard` - Update `/matchup/:id/stats` response

**Frontend:**
- `web/src/api/analysis.ts` - Update `MatchupStatsData` type
- `web/src/routes/matchup/[id].tsx` - Add Contextual/Full toggle
- `web/src/components/matchup/stat-comparison.tsx` - Use venue-filtered stats
- `web/src/components/matchup/stats-table.tsx` - Support full split view

## Future Consolidation

Once venue-filtered snapshots are available:
- `/teams/:id/performance` could be deprecated or consolidated
- Single `Snapshot` model becomes the universal stat representation

## Impact

Medium - Requires API changes and frontend updates, but provides significantly better matchup analysis for betting decisions.
