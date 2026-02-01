# Maestro Desktop App Plan

## Overview
Maestro Desktop is a macOS-only SwiftUI application for viewing fixtures, stats, and tracking bets. It is a local-first app that reads and writes to a local SQLite database using the same schema as the hosted API server. The app fetches updates directly from API-Football and never depends on the hosted API.

## Goals
- Provide a fast, desktop-optimized interface for fixtures and stats.
- Support recording bets and updating outcomes locally.
- Use a local SQLite database (same schema as the API server) for continuity.
- Work offline with cached data and graceful degraded behavior.

## Non-Goals (for now)
- Distribution or auto-updates.
- Odds ingestion or AI betting.

## Data Model and Storage
- SQLite database uses the same schema as the hosted API server.
- The app ships with a baseline SQLite file or creates one on first run.
- API-Football key is stored in the local database (settings table).

## Sync Model (mirrors api/server/fixtures.ard)
Fixtures are not fetched for display. All fixture listings come from the local database.

Sync only updates existing unfinished fixtures:
- Every 1 hour (same interval as fixtures.ard).
- For each followed league, get current season from API-Football.
- If league needs sync (synced_at + needs_sync logic), run sync_season.
- sync_season:
  - If fixtures exist for league+season: run sync_fixtures.
  - If fixtures do not exist: skip import for now (fixtures are expected to be preloaded).
- sync_fixtures:
  - Query all fixtures where finished = false for league+season.
  - For each fixture:
    - Fetch fixture details from API-Football by ID.
    - Decode stats and update fixtures + fixture_stats + teams.
  - Update leagues.synced_at.

Live fixtures (status in-play) refresh every 5 minutes, but only while the fixture tab is open.

## Offline Behavior
- Offline mode displays cached fixtures and stats.
- Sync actions are disabled and UI shows offline status.
- Bets remain usable locally.

## UI and UX
### Visual Language (Paper Terminal)
- Light-first, system light/dark support.
- Monospaced typography, compact spacing.
- High-contrast borders, minimal decoration.
- System accent color for highlights.

### Main Screen
- Left column: followed leagues + date controls.
- Center column: fixture list for selected date.
- Global tab bar: open fixture detail tabs.

### Fixture Detail (Tabbed)
- Header: status, score (live/finished), kickoff time.
- Tabs:
  - Match Stats (default when live or finished).
  - Pre-match (when match not in play, or as a secondary tab).
- Bets card appears above match stats when in the Match Stats tab.

### Match Stats
- Comparison bars for key stats:
  - Shots, shots on target, corners, possession, fouls, yellow/red, xG.

### Bets
- Local CRUD for bets.
- Context menu for result updates (Win/Lose/Push/Delete).
- P&L shown using the same rules as the web app.

## Implementation Notes (SwiftUI)
- Custom tab bar (global) for fixture tabs.
- Repository layer for DB operations (leagues, fixtures, stats, bets).
- API client that mirrors the parsing logic from api/server/fixtures.ard.
- Connectivity monitor to toggle online/offline behavior.

## Open Items
- Decide baseline DB bootstrapping strategy (bundle vs empty + import).
- Define needs_sync logic in Swift to match the server behavior.
- Add settings screen for API-Football key (stored in DB).
