# Agents Guide

## Architecture

This is a soccer statistics API

## Technologies

**server/** - HTTP API in [Ard language](https://www.ard.run/getting-started/introduction/)

- Routes: /juice, /bets, /leagues, /matches, /analysis
- Database: SQLite
- Auth: X-Api-Token header check
- External data: [API-football.com](https://www.api-football.com/documentation-v3) via match/predictions/odds modules

## Build & Test Commands

**Server (Ard):**
- `ard check [FILEPATH]` - Does type checking on a file
- `ard run server/main.ard` - Run HTTP server on $PORT (default 8080)
