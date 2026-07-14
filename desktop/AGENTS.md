# AGENTS.md

This file provides guidance to coding agents when working in the desktop app.

## Overview

Maestro Desktop is a native macOS app for exploring soccer data. It uses a local SQLite database synced directly from the API-Football.com API. The product is a personal tactical lens on football — fixtures, form, possession, xG, and (planned) formations, opposition context, and player-level slicing.

See `docs/tactical-revamp-plan.md` for the current direction.

## Technology Stack

- **Language**: Swift 6.2
- **UI Framework**: SwiftUI (macOS 14+)
- **Build System**: Swift Package Manager
- **Database**: SQLite3 (C API, no ORM)
- **External APIs**:
  - API-Football.com v3 (fixtures, stats, standings, lineups)
  - OpenAI Chat Completions API (in-app AI chat only)

## Development Commands

```bash
cd desktop

# Build debug
swift build

# Build release
swift build --configuration release

# Run debug build
swift run

# Run release build
.build/release/Maestro
```

The built executable is a plain binary, not an app bundle. To enable keyboard input when running from terminal, the app sets `NSApplication.shared.setActivationPolicy(.regular)` on launch.

## Project Structure

```
MaestroDesktop/
├── Package.swift
├── Sources/MaestroDesktop/
│   ├── App/
│   │   ├── MaestroDesktopApp.swift    # @main entry point
│   │   ├── AppState.swift             # Global observable state
│   │   ├── SessionState.swift         # Tab persistence
│   │   └── AppCommandNotifications.swift
│   ├── Data/
│   │   ├── API/
│   │   │   ├── APIFootballClient.swift  # API-Football.com client
│   │   │   ├── ChatService.swift        # OpenAI chat wrapper
│   │   │   └── ChatTools.swift          # Tool definitions for chat
│   │   ├── DB/
│   │   │   ├── Database.swift           # SQLite connection singleton
│   │   │   ├── FixtureRepository.swift
│   │   │   ├── LeagueRepository.swift
│   │   │   ├── PreMatchRepository.swift
│   │   │   ├── SettingsRepository.swift
│   │   │   └── TeamRepository.swift
│   │   └── Sync/
│   │       └── SyncService.swift        # Fixture sync from API
│   ├── Models/
│   │   ├── ChatModels.swift
│   │   ├── FixtureModels.swift
│   │   ├── LeagueModels.swift
│   │   ├── PreMatchModels.swift
│   │   └── StatsModels.swift
│   └── UI/
│       ├── Screens/
│       │   ├── MainScreen.swift
│       │   ├── FixtureDetailView.swift
│       │   ├── FixtureTabView.swift
│       │   ├── LeagueDetailView.swift
│       │   ├── LeagueSearchView.swift
│       │   ├── SettingsView.swift
│       │   └── TeamDetailView.swift
│       └── Components/
│           ├── ChatBubbleView.swift
│           ├── ChatFloatingButton.swift
│           ├── ChatPanelView.swift
│           ├── ChatViewModel.swift
│           ├── MatchupBar.swift
│           ├── StatComparisonRow.swift
│           ├── TeamPositionView.swift
│           └── ToastView.swift
```

## Architecture Patterns

### State Management

- `AppState` is the single source of truth, passed via `@EnvironmentObject`
- Contains: selected date, followed leagues, open fixture/league/team tabs, API tokens
- Repositories are instantiated locally in views, not injected

### Database Layer

- Direct SQLite3 C API usage (no wrappers)
- Database singleton at `Database.shared.handle`
- Tables created lazily in repository `init()` methods via `ensureTable()`
- Pattern for queries:
```swift
let sql = "SELECT ... FROM ... WHERE ...;"
var statement: OpaquePointer?
if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
    sqlite3_bind_int64(statement, 1, Int64(value))
    while sqlite3_step(statement) == SQLITE_ROW {
        // Extract columns
    }
    sqlite3_finalize(statement)
}
```

### Data Flow

1. User follows leagues in `LeagueSearchView`
2. `SyncService.importLeague()` fetches all fixtures from API-Football
3. Fixtures stored in local SQLite, displayed in `MainScreen`
4. Opening a fixture creates a tab, shows `FixtureDetailView`
5. For live matches, `SyncService.syncFixture()` auto-refreshes every 10 minutes

### Fixture Views

- **Pre-match**: form, season stats comparison, attack-vs-defense matchup
- **In-play / Finished**: live/final match statistics + pre-match view

## Key Patterns

### SwiftUI Views

- Use `@State` for local view state
- Use `@EnvironmentObject` for `AppState`
- Instantiate repositories as `private let` properties
- Load data in `onAppear`, reload on `onChange` of dependencies

### Relative Timestamps

```swift
let formatter = RelativeDateTimeFormatter()
formatter.unitsStyle = .abbreviated
return formatter.localizedString(for: date, relativeTo: Date())
```

## Data Storage

- Database location: `~/Library/Application Support/com.akonwi.maestro/db.sqlite`
- Settings (API keys) stored in `settings` table with key-value pairs

## External API Integration

### API-Football.com

- Requires API key stored in settings
- Rate limited; sync operations fetch fixture lists then individual details

### OpenAI

- Used by the in-app AI chat (`ChatService` + `ChatTools`)
- Standard Chat Completions API with function calling
- Tools operate against the local SQLite store

## Notes

- Bundle identifier: `com.akonwi.maestro`
- The app runs as a plain executable; for proper macOS integration (Dock icon, keyboard focus), it sets activation policy to `.regular`
- No external Swift dependencies — only system frameworks and SQLite3
- Historical schemas from the removed odds/betting features may still exist in the local SQLite file for existing users. New code does not read or write them.
