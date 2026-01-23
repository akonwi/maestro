# AGENTS.md

This file provides guidance to coding agents when working in this repository.

## Project Overview

Maestro is a soccer statistics platform with two main components:

1. **Web App** (`web/`) - SolidJS single-page application for viewing and managing soccer statistics
2. **API Server** (`api/server/`) - Backend HTTP API written in Ard

The web app is deployed to GitHub Pages, and the API is hosted on Zeabur.

## Philosophy

This codebase will outlive you. Every shortcut becomes someone else's burden. Evey hack compounds into technical debt that slows the whole team down.

You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.

## Technology Stack

### Web (`web/`)
- **Framework**: SolidJS with SolidStart (file-based routing)
- **Styling**: Tailwind CSS v4 + DaisyUI components
- **State Management**: @tanstack/solid-query for server state, Solid contexts for app state
- **UI Components**: @kobalte/core (headless components)
- **Build Tool**: Vinxi
- **Runtime**: Bun (required: Node >=22)
- **Linting/Formatting**: Biome (configured in root `biome.json`)

### API (`api/server/`)
- **Language**: Ard - [Documentation](https://www.ard.run/getting-started/introduction/)
- **Database**: SQLite with custom migration system
- **External Data**: API-Football.com v3
- **Auth**: X-Api-Token header
- **Deployment**: Docker with multi-stage build

## Development Commands

### Web App
```bash
cd web

# Install dependencies
bun install

# Development server (runs on port 3001)
bun run dev

# Production build (static site)
bun run build

# Preview production build
bun run start
```

### API Server
```bash
cd api

# Run migrations
cd server
ard run migrations.ard up      # Apply pending migrations
ard run migrations.ard down    # Rollback last batch
ard run migrations.ard status  # Check migration status

# Run server (default port 8080, override with PORT env var)
ard run server/main.ard

# Docker build (requires GITHUB_TOKEN for private Ard repo)
docker build --build-arg GITHUB_TOKEN=<token> -t maestro .
```

### Linting & Formatting (Root Level)
```bash
# Biome handles both web and API code
biome check .
biome format .
```

## Architecture

### Web App Structure

The app uses file-based routing with the following key patterns:

- **Routes** (`web/src/routes/`) - Top-level pages map to URLs
- **Components** (`web/src/components/`) - Reusable UI components
- **API Hooks** (`web/src/api/`) - @tanstack/solid-query hooks for each API domain (leagues, fixtures, teams, bets, analysis)
- **Contexts** (`web/src/contexts/`) - Global state providers
  - `AuthProvider` - Manages X-Api-Token in localStorage, provides headers() and isReadOnly() methods
  - `BetFormProvider` - Manages bet form state across the app
- **Data Hooks** (`web/src/hooks/data/`) - Domain-specific data fetching hooks

**Important Web Patterns:**
- API calls use `import.meta.env.VITE_API_BASE_URL` for the backend URL
- All mutations check `auth.isReadOnly()` before making write requests
- Use DaisyUI components where possible; only build custom components when DaisyUI lacks support
- Avoid excessive comments; only document complex logic

### API Server Structure

The Ard server is organized into domain modules:

- `main.ard` - HTTP server entry point, routing, middleware
- `db.ard` - Database connection and query utilities
- `migrations.ard` - Custom migration system (migrations in `migrations/` directory)
- Domain modules: `leagues.ard`, `fixtures.ard`, `teams.ard`, `bets.ard`, `predictions.ard`, `analysis.ard`, `odds.ard`
- `config.ard` - Configuration and environment variable handling

**API Endpoints:**
- `/juice` - Main data endpoint
- `/bets` - Betting records
- `/leagues` - League management
- `/matches` - Match/fixture data
- `/analysis` - Statistical analysis

**Important Ard Patterns:**
- Use `try expr -> default_val` for error handling with fallback values
- Use `try expr -> err { handler(err) }` for error handling with custom error handlers
- Pattern matching with `match` for control flow
- HTTP responses use global `res_headers` map (CORS pre-configured)
- Module imports: `use maestro/module_name` or `use ard/stdlib_module`
- Function syntax: `fn name(param: Type) ReturnType { ... }`
- Result type: `Value!ErrorType` (e.g., `Str!Str` for string result or string error)

### Authentication Flow

1. Web app stores token in localStorage via `AuthProvider`
2. API hooks call `auth.headers()` to get `{"X-Api-Token": token}`
3. API server validates token in request headers
4. Read-only mode: Token is empty string, mutations are skipped client-side

### Data Sources

- **Maestro API** (https://maestro-api.zeabur.app) - Primary backend for leagues, bets, fixtures
- **API-Football.com** - External soccer data API (teams, predictions, odds)

### Deployment

**Web App:**
- Deployed to GitHub Pages via `.github/workflows/deploy.yml`
- Static build with `BASE_PATH=/maestro` and `VITE_API_BASE_URL=https://maestro-api.zeabur.app`
- Triggers on push to `main` branch

**API Server:**
- Deployed to Zeabur using Docker
- `entrypoint.sh` runs migrations then starts server
- Requires `DB_PATH` env var (defaults to `./db.sqlite`)
- Requires `PORT` env var (defaults to 8080)

## Migration System

The API uses a custom Ard-based migration system:

- Migrations are SQL files in `api/server/migrations/`
- Format: `NNN_description.up.sql` and `NNN_description.down.sql`
- Tracks applied migrations in `migrations` table with batch numbers
- Always run `ard run migrations.ard up` before starting the server (handled by `entrypoint.sh` in Docker)

## Environment Variables

### Web
- `VITE_API_BASE_URL` - Backend API URL (default: https://maestro-api.zeabur.app)
- `BASE_PATH` - Base path for routing (default: none, set to `/maestro` for GitHub Pages)

### API
- `DB_PATH` - SQLite database path (default: `./db.sqlite`)
- `PORT` - HTTP server port (default: 8080)
- `HOST` - Server host (default: 0.0.0.0 in Docker)
- `X_API_TOKEN` - Valid API token for authentication

## Documentation

Feature-specific documentation is available in the `docs/` folder:

- `docs/caching.md` - Caching strategies
- `docs/league-management.md` - League follow/hide functionality

## Notes

- Ard is a custom compiled language. For language syntax and standard library reference, see https://www.ard.run/getting-started/introduction/
- The web app is fully static after build, no server-side rendering at runtime
- Biome configuration at root applies to both web and API TypeScript code (if any)
- The web app uses `clientOnly()` for components that require browser APIs (e.g., `AuthProvider`)
