# Metrics Visualization Ideas

Alternative visualizations for attack vs defense metrics on the matchup page.

## Current Implementation

The `MetricsMatchup` component uses horizontal comparison bars showing attack metrics vs defense metrics for each stat (shots, on target, blocked, etc.).

## Future Visualization Ideas

### 1. Shot Funnel

Show the progression from total shots → on target → in box → xG as a funnel diagram. Visualizes shot quality and efficiency - a wider top with narrow bottom means lots of low-quality chances.

For matchup context, show two funnels side-by-side comparing attack creation vs defense allowance at each stage.

```
┌─────────────────────────────────────────────────────┐
│              Arsenal Attack vs Chelsea Defense       │
├─────────────────────────────────────────────────────┤
│                                                     │
│    ┌─────────────────────────────────────────┐      │
│    │           Total Shots: 14.2             │      │
│    └──────────┬───────────────────┬──────────┘      │
│               │                   │                 │
│        ┌──────┴───────────────────┴──────┐          │
│        │       On Target: 5.8            │          │
│        └────────┬─────────────┬──────────┘          │
│                 │             │                     │
│           ┌─────┴─────────────┴─────┐               │
│           │    In Box: 4.1          │               │
│           └───────┬─────────┬───────┘               │
│                   │         │                       │
│              ┌────┴─────────┴────┐                  │
│              │    xG: 1.42       │                  │
│              └───────────────────┘                  │
│                                                     │
│  Conversion: 10% of shots become expected goals     │
└─────────────────────────────────────────────────────┘
```

### 2. Radar/Spider Chart

Plot all metrics on a radial chart with attack metrics as one polygon overlaid on defense metrics as another. Instantly see the "shape" of each matchup - where attack outpaces defense and vice versa.

```
┌─────────────────────────────────────────────────────┐
│         Arsenal Attack vs Chelsea Defense            │
├─────────────────────────────────────────────────────┤
│                      Shots                          │
│                        ▲                            │
│                       /|\                           │
│                      / | \                          │
│                     /  |  \                         │
│         Corners   /    |    \   On Target           │
│                 ◄──────┼──────►                     │
│                  \     |     /                      │
│                   \    |    /                       │
│                    \   |   /                        │
│                     \  |  /                         │
│            xG        \ | /        In Box            │
│                       \|/                           │
│                        ▼                            │
│                    Blocked                          │
│                                                     │
│     ── Attack (14.2, 5.8, 4.1, 2.3, 1.42, 6.2)     │
│     ┄┄ Defense (12.1, 4.9, 3.8, 1.9, 1.21, 5.4)    │
│                                                     │
│     Attack extends beyond defense on most axes      │
└─────────────────────────────────────────────────────┘
```

### 3. Shot Outcome Breakdown (Stacked Bar)

Show a single horizontal bar per team where segments represent the proportion of shots: on target | missed | blocked. Quick way to see shot quality without comparing raw numbers.

```
┌─────────────────────────────────────────────────────┐
│              Shot Outcomes per Game                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Arsenal    ████████░░░░░░░░░▒▒▒▒▒▒  14.2 shots    │
│  Attack     On Target  Missed   Blocked             │
│               5.8       5.1      3.3                │
│              (41%)     (36%)    (23%)               │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Chelsea    ██████░░░░░░░░▒▒▒▒▒▒▒▒▒  12.1 shots    │
│  Defense    On Target  Missed   Blocked             │
│               4.9       4.2      3.0                │
│              (40%)     (35%)    (25%)               │
│                                                     │
│  Legend: ████ On Target  ░░░░ Missed  ▒▒▒▒ Blocked │
└─────────────────────────────────────────────────────┘
```

### 4. Advantage Indicator

Instead of showing both values, show a single bar per metric that goes left (defense advantage) or right (attack advantage) from center, with the magnitude showing how big the gap is. Focuses on the differential rather than absolute values.

```
┌─────────────────────────────────────────────────────┐
│         Attack vs Defense: Who Has the Edge?         │
├─────────────────────────────────────────────────────┤
│                                                     │
│                    ◄── DEF    ATK ──►               │
│                         │                           │
│  Shots/Game    ░░░░░░░░░│████████████  +2.1        │
│  On Target     ░░░░░░░░░│██████        +0.9        │
│  In Box        ░░░░░░░░░│████          +0.3        │
│  Blocked       ░░░░░░░░░│████          +0.3        │
│  xG            ░░░░░░░░░│████████      +0.21       │
│  Corners       ░░░░░░░░░│██████████    +0.8        │
│                         │                           │
│                         0                           │
│                                                     │
│  ████ = Attack advantage (creates more)             │
│  ░░░░ = Defense advantage (allows less)             │
│                                                     │
│  Summary: Arsenal attack dominates on all metrics   │
└─────────────────────────────────────────────────────┘
```

## Implementation Notes

- Radar chart would require a charting library (e.g., Chart.js, D3, or a lightweight SVG solution)
- Funnel and stacked bars could be done with pure CSS/Tailwind
- Advantage indicator is similar to current implementation but centered on zero
