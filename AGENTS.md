# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

Maestro is a desktop-only macOS app for exploring soccer data. It syncs fixtures and stats from API-Football into a local SQLite store, then lets the user slice that data along tactical axes (form, possession, xG, and — planned — formations, player performance vs opposition context).

The active application lives in:

- `desktop/` — native SwiftUI app built with Swift Package Manager

## Philosophy

This codebase will outlive you. Every shortcut becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.

You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.

## Technology Stack

- **Language**: Swift 6.2
- **UI Framework**: SwiftUI (macOS 14+)
- **Build System**: Swift Package Manager
- **Database**: SQLite3 (C API, no ORM)
- **External APIs**:
  - API-Football.com v3
  - OpenAI Chat Completions API (used only by the in-app AI chat)

## Development Commands

```bash
cd desktop

# Build debug
swift build

# Run debug
swift run

# Build release
swift build --configuration release

# Run release
.build/release/Maestro
```

## Architecture

### App Structure

- `desktop/Sources/MaestroDesktop/App/` — app entry point and app state
- `desktop/Sources/MaestroDesktop/Data/API/` — API clients
- `desktop/Sources/MaestroDesktop/Data/DB/` — SQLite repositories and caches
- `desktop/Sources/MaestroDesktop/Data/Sync/` — league/fixture sync logic
- `desktop/Sources/MaestroDesktop/Models/` — app data models
- `desktop/Sources/MaestroDesktop/UI/` — SwiftUI screens and components

### Important Patterns

- `AppState` is the main shared state container.
- Repositories use direct SQLite3 C APIs.
- Data is stored locally and synced from API-Football.
- Prefer local-first flows and avoid adding unnecessary abstraction.
- Read before edit; preserve surrounding style.

## Data Storage

- Main local database:
  - `~/Library/Application Support/com.akonwi.maestro/maestro.sqlite`

## Notes

- This repo no longer includes the old web app or Ard API server.
- Treat `desktop/` as the product surface that matters.
- Feature-specific notes live under `desktop/docs/`.
