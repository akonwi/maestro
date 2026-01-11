# 009: Improved Matchup Visualization

**Priority:** Phase 2 - Medium Effort
**Effort:** 3-4 days
**Impact:** Medium-High (UX)

## Problem Statement

Current matchup modal (`web/src/components/matchup.tsx`) has issues:
- **24KB file size** - Too large, hard to maintain
- **Static text comparison** - No visual aids for quick understanding
- **Missing context** - No recent form timeline, home/away comparison
- **No betting insights** - Doesn't highlight why a bet has value
- **Dense layout** - Overwhelming on mobile

Users struggle to quickly assess matchup quality and make betting decisions.

## Proposed Solution

Redesign matchup modal with:
1. **Tabbed interface** - Separate Form Comparison, Detailed Stats, Betting Edge
2. **Visual comparison bars** - Show metrics side-by-side with progress bars
3. **Recent form timeline** - Last 5 games as visual W-L-D sequence
4. **Betting edge summary** - Natural language explanation of value
5. **Refactor into sub-components** - Break 24KB file into manageable pieces

## Implementation

### 1. Component Structure

**New File Structure:**
```
web/src/components/matchup/
  ├── index.tsx              (Main orchestrator, <300 lines)
  ├── form-comparison.tsx    (Recent vs Season stats)
  ├── weighted-analysis.tsx  (70/30 weighted metrics)
  ├── detailed-stats.tsx     (Shot metrics, xG breakdown)
  ├── betting-edge.tsx       (Why this bet has value)
  └── form-timeline.tsx      (Last 5 games visual)
```

### 2. Main Matchup Component

**File:** `web/src/components/matchup/index.tsx`

```tsx
import { Tabs } from '@kobalte/core';
import { FormComparison } from './form-comparison';
import { WeightedAnalysis } from './weighted-analysis';
import { DetailedStats } from './detailed-stats';
import { BettingEdge } from './betting-edge';

export function Matchup(props: MatchupProps) {
  return (
    <div class="modal modal-open">
      <div class="modal-box max-w-4xl">
        {/* Header */}
        <div class="text-center mb-4">
          <h2 class="text-2xl font-bold">
            {props.homeTeam.name} vs {props.awayTeam.name}
          </h2>
          <div class="text-sm text-base-content/60">
            {props.league} | {props.date}
          </div>
        </div>

        {/* Tabs */}
        <Tabs.Root defaultValue="form">
          <Tabs.List class="tabs tabs-boxed mb-4">
            <Tabs.Trigger class="tab" value="form">
              Form Comparison
            </Tabs.Trigger>
            <Tabs.Trigger class="tab" value="stats">
              Detailed Stats
            </Tabs.Trigger>
            <Tabs.Trigger class="tab" value="edge">
              Betting Edge
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="form">
            <FormComparison
              homeTeam={props.homeTeam}
              awayTeam={props.awayTeam}
            />
            <WeightedAnalysis
              homeTeam={props.homeTeam}
              awayTeam={props.awayTeam}
            />
          </Tabs.Content>

          <Tabs.Content value="stats">
            <DetailedStats
              homeTeam={props.homeTeam}
              awayTeam={props.awayTeam}
            />
          </Tabs.Content>

          <Tabs.Content value="edge">
            <BettingEdge
              homeTeam={props.homeTeam}
              awayTeam={props.awayTeam}
              recommendations={props.recommendations}
            />
          </Tabs.Content>
        </Tabs.Root>

        <div class="modal-action">
          <button class="btn" onClick={props.onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Form Comparison Component

**File:** `web/src/components/matchup/form-comparison.tsx`

```tsx
import { FormTimeline } from './form-timeline';

export function FormComparison(props: { homeTeam: Team; awayTeam: Team }) {
  return (
    <div class="space-y-6">
      <h3 class="text-lg font-semibold">Recent Form (Last 5 Games)</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Home Team */}
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium">{props.homeTeam.name} (Home)</span>
            <FormBadge rating={props.homeTeam.form_rating} />
          </div>
          <FormTimeline games={props.homeTeam.last_5_games} />

          <div class="stats stats-vertical shadow mt-4">
            <ComparisonStat
              label="xGF"
              value={props.homeTeam.last_5_xgf}
              comparison={props.awayTeam.last_5_xgf}
            />
            <ComparisonStat
              label="xGA"
              value={props.homeTeam.last_5_xga}
              comparison={props.awayTeam.last_5_xga}
              inverse  // Lower is better
            />
            <ComparisonStat
              label="Goals Scored"
              value={props.homeTeam.last_5_goals_for}
              comparison={props.awayTeam.last_5_goals_for}
            />
          </div>
        </div>

        {/* Away Team */}
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium">{props.awayTeam.name} (Away)</span>
            <FormBadge rating={props.awayTeam.form_rating} />
          </div>
          <FormTimeline games={props.awayTeam.last_5_games} />

          <div class="stats stats-vertical shadow mt-4">
            <div class="stat">
              <div class="stat-title">Recent Record</div>
              <div class="stat-value text-sm">
                {props.awayTeam.last_5_record}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Comparison stat with visual bar
function ComparisonStat(props: {
  label: string;
  value: number;
  comparison: number;
  inverse?: boolean;
}) {
  const isBetter = props.inverse
    ? props.value < props.comparison
    : props.value > props.comparison;

  const percentage = (props.value / (props.value + props.comparison)) * 100;

  return (
    <div class="stat">
      <div class="stat-title">{props.label}</div>
      <div class="stat-value text-2xl" class:text-success={isBetter} class:text-error={!isBetter}>
        {props.value.toFixed(2)}
      </div>
      <div class="stat-desc">
        <div class="w-full bg-base-300 rounded-full h-2 mt-1">
          <div
            class="h-2 rounded-full"
            class:bg-success={isBetter}
            class:bg-error={!isBetter}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div class="text-xs mt-1">
          vs {props.comparison.toFixed(2)} opponent
        </div>
      </div>
    </div>
  );
}
```

### 4. Form Timeline Visual

**File:** `web/src/components/matchup/form-timeline.tsx`

```tsx
export function FormTimeline(props: { games: Game[] }) {
  return (
    <div class="flex gap-1">
      <For each={props.games}>
        {(game) => (
          <div
            class="flex-1 h-12 rounded flex items-center justify-center text-white font-bold"
            class:bg-success={game.result === 'W'}
            class:bg-warning={game.result === 'D'}
            class:bg-error={game.result === 'L'}
            title={`${game.opponent} ${game.score} (${game.result})`}
          >
            {game.result}
          </div>
        )}
      </For>
    </div>
  );
}
```

### 5. Weighted Analysis with Bars

**File:** `web/src/components/matchup/weighted-analysis.tsx`

```tsx
export function WeightedAnalysis(props: { homeTeam: Team; awayTeam: Team }) {
  return (
    <div class="mt-6">
      <h3 class="text-lg font-semibold mb-4">
        Weighted Analysis (70% Recent + 30% Season)
      </h3>

      <div class="space-y-4">
        <MetricBar
          label="Expected Goals For (xGF)"
          homeValue={props.homeTeam.weighted_xgf}
          awayValue={props.awayTeam.weighted_xgf}
          homeName={props.homeTeam.name}
          awayName={props.awayTeam.name}
        />

        <MetricBar
          label="Expected Goals Against (xGA)"
          homeValue={props.homeTeam.weighted_xga}
          awayValue={props.awayTeam.weighted_xga}
          homeName={props.homeTeam.name}
          awayName={props.awayTeam.name}
          inverse  // Lower is better
        />
      </div>
    </div>
  );
}

function MetricBar(props: {
  label: string;
  homeValue: number;
  awayValue: number;
  homeName: string;
  awayName: string;
  inverse?: boolean;
}) {
  const total = props.homeValue + props.awayValue;
  const homePercent = (props.homeValue / total) * 100;
  const awayPercent = (props.awayValue / total) * 100;

  const homeIsBetter = props.inverse
    ? props.homeValue < props.awayValue
    : props.homeValue > props.awayValue;

  return (
    <div>
      <div class="flex justify-between text-sm mb-1">
        <span>{props.label}</span>
        <div class="flex gap-4">
          <span class:font-bold={homeIsBetter}>
            {props.homeName}: {props.homeValue.toFixed(2)}
          </span>
          <span class:font-bold={!homeIsBetter}>
            {props.awayName}: {props.awayValue.toFixed(2)}
          </span>
        </div>
      </div>

      <div class="flex h-6 rounded overflow-hidden">
        <div
          class:bg-primary={homeIsBetter}
          class:bg-primary/40={!homeIsBetter}
          style={{ width: `${homePercent}%` }}
        />
        <div
          class:bg-secondary={!homeIsBetter}
          class:bg-secondary/40={homeIsBetter}
          style={{ width: `${awayPercent}%` }}
        />
      </div>
    </div>
  );
}
```

### 6. Betting Edge Summary

**File:** `web/src/components/matchup/betting-edge.tsx`

```tsx
export function BettingEdge(props: {
  homeTeam: Team;
  awayTeam: Team;
  recommendations: BetRecommendation[];
}) {
  return (
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">Why These Bets Have Value</h3>

      <For each={props.recommendations}>
        {(bet) => (
          <div class="alert alert-info">
            <div class="flex flex-col gap-2">
              <div class="font-semibold">{bet.description}</div>
              <div class="flex gap-4 text-sm">
                <span>Confidence: {bet.confidence}%</span>
                <span class="text-success">EV: +{bet.ev_percentage.toFixed(1)}%</span>
              </div>
              <div class="text-sm">
                {generateEdgeExplanation(bet, props.homeTeam, props.awayTeam)}
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

function generateEdgeExplanation(
  bet: BetRecommendation,
  homeTeam: Team,
  awayTeam: Team
): string {
  // Generate natural language explanation
  // Example: "Arsenal's hot recent form (2.5 xGF) significantly outperforms
  // their season average (1.8), and Chelsea's weak away defense (1.8 xGA)
  // creates high-value opportunity for Over 1.5 goals."

  // Implementation would analyze bet type and metrics
  return "...";
}
```

## Testing

### Visual Testing
- [ ] Tabs switch correctly
- [ ] Form timeline shows W-L-D with correct colors
- [ ] Comparison bars visually represent metric differences
- [ ] Mobile responsive (stacks vertically)
- [ ] All data loads without errors

### Performance
- [ ] Modal opens quickly (< 100ms)
- [ ] No lag when switching tabs
- [ ] File sizes reduced (each component < 200 lines)

## Success Criteria

- [ ] Matchup modal refactored into sub-components
- [ ] Each component file < 300 lines
- [ ] Visual comparison bars implemented
- [ ] Recent form timeline shows last 5 games
- [ ] Betting edge summary provides clear explanations
- [ ] Responsive design works on mobile
- [ ] User testing shows improved clarity and decision speed

## Related Enhancements

- [001: Recent Form Weighting](../betting-strategy/001-recent-form-weighting.md) - Provides weighted metrics
- [002: Home/Away Splits](../betting-strategy/002-home-away-splits.md) - Display venue-specific stats
- [003: Confidence Scoring](../betting-strategy/003-confidence-scoring.md) - Show in betting edge section
