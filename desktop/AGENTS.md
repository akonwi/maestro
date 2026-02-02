# AGENTS.md

This file provides guidance to coding agents when working in the desktop app.

## Overview

Maestro Desktop is a native macOS app for viewing soccer fixtures, tracking stats, and managing bets. It's a companion to the web app, using its own local SQLite database synced from the API-Football.com API.

## Technology Stack

- **Language**: Swift 6.2
- **UI Framework**: SwiftUI (macOS 14+)
- **Build System**: Swift Package Manager
- **Database**: SQLite3 (C API, no ORM)
- **External APIs**:
  - API-Football.com v3 (fixtures, odds, stats)
  - OpenAI Responses API (corner betting analysis)

## Development Commands

```bash
cd desktop/MaestroDesktop

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
│   │   └── AppState.swift             # Global observable state
│   ├── Data/
│   │   ├── API/
│   │   │   ├── APIFootballClient.swift  # API-Football.com client
│   │   │   └── OpenAIService.swift      # OpenAI corner analysis
│   │   ├── DB/
│   │   │   ├── Database.swift           # SQLite connection singleton
│   │   │   ├── *Repository.swift        # Domain data access
│   │   │   └── *Cache.swift             # Caching layers
│   │   └── Sync/
│   │       └── SyncService.swift        # Fixture sync from API
│   ├── Models/
│   │   ├── FixtureModels.swift
│   │   ├── BetModels.swift
│   │   ├── StatsModels.swift
│   │   └── PreMatchModels.swift
│   └── UI/
│       ├── Screens/
│       │   ├── MainScreen.swift         # Primary navigation
│       │   ├── FixtureDetailView.swift  # Fixture stats/betting
│       │   ├── BetsListView.swift       # Bet history
│       │   ├── SettingsView.swift       # API keys config
│       │   └── LeagueSearchView.swift   # Follow leagues
│       └── Components/
│           ├── BetFormSheet.swift
│           ├── StatComparisonRow.swift
│           ├── MatchupBar.swift
│           └── ToastView.swift
```

## Architecture Patterns

### State Management

- `AppState` is the single source of truth, passed via `@EnvironmentObject`
- Contains: selected date, followed leagues, open fixture tabs, API tokens, bet stats
- Repositories are instantiated locally in views, not injected

### Database Layer

- Direct SQLite3 C API usage (no wrappers)
- Database singleton at `Database.shared.handle`
- Tables created lazily in repository/cache `init()` methods via `ensureTable()`
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

### Fixture Lifecycle States

- **Pre-match**: Shows pre-match stats, corner odds, AI analysis, bet recording
- **In-play**: Shows live stats, recorded bets with settle buttons, cached AI analysis (read-only)
- **Finished**: Shows final stats, pre-match data, settled bets

### Caching

- `OddsCache`: In-memory cache for corner odds (1 hour TTL)
- `AnalysisCache`: SQLite-persisted AI analyses (no expiry, includes timestamp)

## Key Patterns

### SwiftUI Views

- Use `@State` for local view state
- Use `@EnvironmentObject` for `AppState`
- Instantiate repositories as `private let` properties
- Load data in `onAppear`, reload on `onChange` of dependencies

### American Odds Display

```swift
// Format: +150 (positive) or -110 (negative)
let formatted = odds > 0 ? "+\(odds)" : "\(odds)"
```

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
- Corner odds from bookmaker endpoints (market IDs: 45, 55, 56, 57, 58, 85)

### OpenAI

- Uses Responses API with stored prompts
- Prompt ID configured in `OpenAIService`
- Response parsing handles nested `output[0].content[0].text` structure
- Strips markdown code blocks from responses

## Notes

- Bundle identifier: `com.akonwi.maestro`
- The app runs as a plain executable; for proper macOS integration (Dock icon, keyboard focus), it sets activation policy to `.regular`
- No external Swift dependencies - only system frameworks and SQLite3
