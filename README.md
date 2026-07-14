# Maestro

Maestro is a native macOS desktop app for tracking soccer fixtures, syncing league data from API-Football, and managing bets with a local SQLite database.

This repository is now desktop-only.

## What it does

- Follow leagues and sync their current-season fixtures
- Store fixture, team, and stats data locally in SQLite
- View upcoming, live, and finished matches
- Track bets and outcomes
- Run pre-match and matchup analysis for fixtures
- Use OpenAI-powered corner betting analysis inside the app

## Tech stack

- Swift 6.2
- SwiftUI
- SQLite3
- Swift Package Manager
- API-Football.com API
- OpenAI Responses API

## Repository structure

```text
./desktop
  Package.swift
  Sources/MaestroDesktop
  docs
  prompts
  scripts
```

## Requirements

- macOS 14+
- Xcode / Command Line Tools with Swift 6.2 support

## Build and run

From the repo root:

```bash
cd desktop

# Debug build
swift build

# Run
swift run

# Release build
swift build --configuration release

# Run release binary
.build/release/Maestro
```

The release executable is a plain macOS binary:

- `desktop/.build/release/Maestro`

## App configuration

Maestro uses API keys configured inside the app:

- **API-Football token** for fixture, stats, and odds sync
- **OpenAI key** for AI analysis features

Open the app and add them in **Settings**.

## Data storage

The app stores its local database in:

```text
~/Library/Application Support/com.akonwi.maestro/maestro.sqlite
```

On first launch, Maestro copies the bundled starter database if available.

## Notes

- The app is built as a native desktop app, not a web app.
- Fixture sync is performed against API-Football and persisted locally.
- The `desktop/docs/` folder contains feature-specific notes and workflows.
