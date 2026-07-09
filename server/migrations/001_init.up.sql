-- Full v1 schema for the Maestro prediction game.
-- See docs/prediction-game-plan.md for the design.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  created_at    INTEGER NOT NULL          -- unix ms
);

CREATE TABLE magic_links (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE competitions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  api_football_league_id INTEGER NOT NULL,
  name                   TEXT NOT NULL,
  season                 INTEGER NOT NULL,
  kind                   TEXT NOT NULL,           -- 'league' | 'cup' | 'playoff'
  is_active              INTEGER NOT NULL DEFAULT 1,
  UNIQUE (api_football_league_id, season)
);

CREATE TABLE teams (
  id   INTEGER PRIMARY KEY,          -- api-football team id
  name TEXT NOT NULL
);

CREATE TABLE fixtures (
  id             INTEGER PRIMARY KEY,  -- api-football fixture id
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  home_team_id   INTEGER NOT NULL REFERENCES teams(id),
  away_team_id   INTEGER NOT NULL REFERENCES teams(id),
  kickoff_at     INTEGER NOT NULL,     -- unix ms
  status         TEXT NOT NULL,        -- NS, LIVE, FT, PST, ...
  home_score     INTEGER,
  away_score     INTEGER
);

CREATE INDEX idx_fixtures_competition ON fixtures(competition_id);
CREATE INDEX idx_fixtures_kickoff ON fixtures(kickoff_at);

CREATE TABLE predictions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points     INTEGER,                  -- null until fixture finishes
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, fixture_id)
);

CREATE INDEX idx_predictions_fixture ON predictions(fixture_id);

CREATE TABLE groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id),
  invite_code TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id),
  user_id   INTEGER NOT NULL REFERENCES users(id),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- Seed the one active competition for v1: MLS regular season 2025.
-- api-football league id 253 = Major League Soccer.
INSERT INTO competitions (api_football_league_id, name, season, kind, is_active)
VALUES (253, 'MLS', 2025, 'league', 1);
