# Agents Guide

## Architecture

**maestro-api** is a soccer statistics API with two subprojects:

1. **server/** - HTTP API in Ard language
   - Routes: /juice, /bets, /leagues, /matches, /analysis
   - Database: SQLite (maestro.sqlite)
   - Auth: X-Api-Token header check
   - External data: API-football.com via match/predictions/odds modules

## Build & Test Commands

**Server (Ard):**
Requires `ard` binary (in PATH)
- `ard check [FILEPATH]` - Does type checking on a file
- `ard run server/main.ard` - Run HTTP server on $PORT (default 8080)

## Code Style & Conventions

**Ard (server/):**
- Pattern matching for control flow (match/switch)
- Error handling: `try expr -> default_val` or `try expr -> err { error_handler(err) }`
- HTTP responses: use global `res_headers`, return `http::Response{status, body, headers}`
- Module structure: `use maestro/module_name` for imports
- Functions: `fn name(param: Type) ReturnType { ... }`
