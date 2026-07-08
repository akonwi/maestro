# Tactical Revamp Plan

## Why

Maestro was originally built around fixtures + odds + bet tracking. In practice, the odds/betting features aren't the way I actually explore football. My real lens is tactical:

- Form (results, xG, possession trends)
- Possession quality and **pitch tilt** (where on the field a team operates)
- In-possession vs out-of-possession performance
- **Formations** — usage and performance, for both a team and its opposition
- Head-to-head across all of the above
- Player performance sliced by **own formation, position played, opposition formation, opposition strength**

This document plans the pivot of Maestro's center of gravity from odds/betting to tactical analysis, while keeping the desktop-only, local-first, SQLite-backed architecture intact.

## Product Thesis

A personal tactical lens on football, built for how I comprehend the game. Not a general-purpose stats site — a tool that lets me slice data along the axes I actually think in.

- **Scope, initial:** Manchester City, in the Premier League. Depth first.
- **Scope, inevitable:** full Premier League. Slicing City vs opposition context (formation, strength, style) requires the whole league's data. City-first is the UI framing; PL-wide is the data footprint.
- **Platform:** macOS desktop only. Load-bearing decision — local SQLite means aggressive caching of historical data, staying inside API rate limits, and enabling exploratory queries without a server.
- **Data source:** stay on API-Football. `football-data.org` was evaluated and rejected — it lacks the fixture-level statistics, lineups with formations, and per-player fixture stats that this direction requires.
- **Odds/betting:** dormant, not deleted. Tables, sync paths, and UI can stay; they just stop being the app's front door.

## Data Feasibility (against API-Football)

| Lens | Feasibility | Source |
|---|---|---|
| Form (results, rolling) | ✅ | Existing fixtures |
| Possession, shots, xG per match | ✅ | Existing fixture statistics |
| **Formations per match** | ✅ | `/fixtures/lineups` — includes formation string per team |
| Player position / grid per match | ✅ | `/fixtures/lineups` |
| Per-player per-match stats (rating, passes, duels, shots, dribbles, tackles, minutes…) | ✅ | `/fixtures/players` |
| Opposition strength | ✅ | Computed locally (see Elo) |
| **True pitch tilt** (final-third touch share) | ❌ | Requires event data (Opta/StatsBomb). Not sold at consumer prices. Possible future path: scrape FBref for touches-by-third. |
| In-possession vs out-of-possession splits | ⚠️ proxy only | True phase splits need event data. Approximate via attacking output normalized by possession share vs defensive actions. |

**Takeaway:** API-Football covers ~80% of the wishlist. The missing 20% (real pitch tilt, real phase-of-play splits) will need scraping or a step up to an event-data provider. Not a v1 problem.

## Sync Budget

A PL season is 380 fixtures. New per-fixture calls needed:

- `/fixtures/lineups?fixture=…` — 1 call
- `/fixtures/players?fixture=…` — 1 call

≈ **760 new calls to backfill a full PL season**, then ~20–30 per gameweek to stay current. Trivial on any paid tier, workable trickled on the free tier. This is a one-time cost per season since results are stored locally.

Historical seasons multiply this linearly — needed for cross-season baselines ("is City's tilt up vs last season?") but can be backfilled lazily.

## Elo (Own Implementation)

Opposition strength is core to the "player performance vs opposition strength" slice, and the league table is a poor strength measure (noisy early season, doesn't carry over, hides schedule quality). Roll our own Elo.

### v1 (dumb but honest)

- Start every team at 1500 at the beginning of tracked history.
- Update after every synced match: `new = old + K × (actual − expected)`, where `expected = 1 / (1 + 10^((opp − self − home_adv) / 400))`.
- **K:** 20 (football convention).
- **Home advantage:** 65 points.
- **Draws:** 0.5 / 0.5.
- **Margin of victory:** ignore initially; add later.
- **Season carryover:** 100%, no regression.
- **Competitions:** league matches only for v1.

### Knobs to expose later (this is the fun part)

- K-factor (globally, per-competition, or elevated for the first N matches of a season)
- Home advantage magnitude (PL home advantage has shrunk post-2020 — worth playing with)
- Margin-of-victory function (none / linear / `log(goal_diff)` à la 538)
- Summer regression toward mean (0% / 25% / 50%)
- Cross-competition inclusion (CL, FA Cup — adds cross-league calibration, adds rotated-squad volatility)

Long-term: the app should let me tweak these live and re-run history to see how City's rating curve changes. That "what if I believed X about football strength" exploration is on-brand for the whole project.

### Fallback

Table quartiles ("elite / good / mid / weak") are a reasonable v1 if Elo slips. Elo is an upgrade, not a prerequisite for the first milestones.

## New Data Model

New tables (SQLite, same conventions as existing repositories):

- `lineups` — `(fixture_id, team_id, formation, coach_id, coach_name)`
- `lineup_players` — `(fixture_id, team_id, player_id, player_name, position, grid, started)`
- `player_fixture_stats` — the big one. Per (fixture, player): minutes, rating, goals, assists, shots, shots_on, passes, pass_accuracy, key_passes, dribbles_attempted, dribbles_completed, duels_total, duels_won, tackles, interceptions, fouls_committed, fouls_drawn, cards, and whatever else `/fixtures/players` exposes worth keeping.
- `team_elo_snapshots` — `(team_id, as_of_fixture_id, rating)`. Recomputed rather than mutated; makes tuning cheap.
- `elo_config` — persisted knob values, so ratings are reproducible from history + config.

Existing tables (fixtures, fixture_statistics, standings, bets, odds, analyses) stay as-is.

## Derived Layer (no API calls)

Everything downstream of raw sync is pure SQL / Swift over the local store:

- Rolling form windows (last 5 / 10, all-competitions vs league-only)
- Possession-adjusted output (proxy for in-possession performance)
- Defensive actions per opponent possession (proxy for out-of-possession)
- Formation usage frequency & PPG / xG-per-90 per formation, per team
- H2H matrices across all of the above
- Opposition-strength buckets (Elo quartiles, or continuous)
- Player slices: rating & output splits by own formation × position × opposition formation × opposition strength

## Milestones

Smallest-useful-first. Each milestone should visibly change how I see City before the next one starts.

### M1 — Formation layer

- Sync `/fixtures/lineups` PL-wide for the current season.
- New tables: `lineups`, `lineup_players`.
- New view: City's formation usage this season, PPG and xG per formation, and how opponents set up against City.
- **Validation goal:** does formation-sliced data actually shift how I see City? If yes, commit to M3. If no, rethink before the heavy backfill.

### M2 — Team tactical dashboard

- Rebuild the primary team view around form + possession trend + xG trend + formation performance.
- H2H view reframed around these axes.
- Odds/betting UI moves out of the front door but stays reachable.

### M3 — Player fixture stats sync

- Sync `/fixtures/players` PL-wide, current season backfill.
- New table: `player_fixture_stats`.
- No new UI yet — this milestone is data plumbing.

### M4 — Player slicing views

- The crown jewel. Player performance filtered/grouped by own formation, position played, opposition formation, opposition strength.
- Start with City players; generalize to any PL player.

### M5 — Elo

- Implement v1 Elo over synced history.
- Wire opposition-strength buckets in M4 to Elo instead of table quartiles.
- Expose config knobs in Settings; recompute on knob change.

### M6 — Chat tools upgrade

- Point the existing `ChatTools` at the new local store.
- Add tools for formation queries, player slices, Elo lookups.
- Goal: I can ask tactical questions in natural language and get answers grounded in the local DB.

### Deferred / maybe

- Historical season backfills (multi-year baselines)
- FBref scraping for true pitch tilt (touches by third)
- Margin-of-victory and cross-competition Elo variants
- Style clustering (grouping teams by playing profile, then slicing performance against style rather than strength)

## Open Questions

- Do I want player-composite ratings I control (weighted from raw stats) instead of trusting API-Football's opaque rating? Likely yes eventually — matches the "built for how I comprehend the game" ethos — but their rating is a fine bootstrap.
- How far back do I backfill? Current season is the M1–M4 target. Prior seasons are worth it once slicing views exist and cross-season comparisons become interesting.
- When (if ever) is the odds/betting surface removed rather than dormant?
