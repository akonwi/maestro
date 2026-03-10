# Maestro Desktop App Plan

## Overview
Maestro Desktop is a macOS-only SwiftUI application for viewing fixtures, stats, and tracking bets. It is a local-first app that reads and writes to a local SQLite database and syncs directly from API-Football.

## Goals
- Provide a fast, desktop-optimized interface for fixtures and stats.
- Support recording bets and updating outcomes locally.
- Use a local SQLite database for continuity and offline access.
- Work offline with cached data and graceful degraded behavior.

## Non-Goals (for now)
- Distribution or auto-updates.
- Multi-platform support.

## Data Model and Storage
- SQLite is the source of truth for the app UI.
- The app ships with a baseline SQLite file or creates one on first run.
- API-Football and OpenAI keys are stored locally in the settings table.

## Sync Model
Fixtures are not fetched directly for display. The UI reads from the local database.

League sync:
- Determine the league's current season from API-Football.
- If no fixtures exist locally for that league and season, perform a full import.
- If fixtures already exist locally:
  - refresh unfinished fixtures already in the database
  - reconcile the season fixture list and insert newly published fixtures that are missing locally
- Update the league sync timestamp and current season after a successful sync.

Fixture sync:
- Fetch a single fixture by ID from API-Football.
- Save it into the local database, inserting or updating as needed.
- If full statistics are present, persist them to `fixture_stats`.

Live fixtures can refresh periodically while the fixture tab is open.

## Offline Behavior
- Offline mode displays cached fixtures and stats.
- Sync actions are disabled and UI shows offline status.
- Bets remain usable locally.

## UI and UX
### Visual Language
- Light-first, system light/dark support.
- Monospaced typography, compact spacing.
- High-contrast borders, minimal decoration.
- System accent color for highlights.

### Main Screen
- Left column: followed leagues + date controls.
- Center column: fixture list for selected date.
- Global tab bar: open fixture detail tabs.

### Fixture Detail
- Header: status, score (live/finished), kickoff time.
- Tabs surface pre-match and match stats depending on fixture state.
- Betting tools and recorded bets are available in fixture context.

### Bets
- Local CRUD for bets.
- Result updates and local P&L tracking.

## Implementation Notes
- SwiftUI app with `AppState` as the main shared state container.
- Repository layer for DB operations (leagues, fixtures, stats, bets).
- Direct API-Football client for fixture, league, standings, and odds data.
- Connectivity-aware sync behavior where practical.

## Open Items
- Decide long-term app distribution strategy.
- Continue tightening sync behavior and failure recovery.
- Improve packaged starter database strategy.
