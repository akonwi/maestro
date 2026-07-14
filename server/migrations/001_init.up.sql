-- Production v1 schema for the Maestro prediction game.
-- Fixture and team data remain upstream in API-Football; SQLite stores only
-- game-owned data and durable scoring workflow state.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  created_at    INTEGER NOT NULL
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
  kind                   TEXT NOT NULL,
  is_active              INTEGER NOT NULL DEFAULT 1,
  UNIQUE (api_football_league_id, season)
);

CREATE TABLE predictions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  fixture_id INTEGER NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points     INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, fixture_id)
);

CREATE INDEX idx_predictions_fixture ON predictions(fixture_id);

CREATE TABLE groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  owner_id   INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id),
  user_id   INTEGER NOT NULL REFERENCES users(id),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE fixture_scoring_state (
  fixture_id         INTEGER PRIMARY KEY,
  competition_id    INTEGER NOT NULL REFERENCES competitions(id),
  kickoff_at         INTEGER NOT NULL,
  prediction_lock_at INTEGER NOT NULL,
  state              TEXT NOT NULL CHECK (state IN ('pending', 'settled', 'void')),
  provider_status    TEXT,
  next_check_at      INTEGER,
  attempt_count      INTEGER NOT NULL DEFAULT 0,
  last_checked_at    INTEGER,
  last_error         TEXT,
  final_home_score   INTEGER,
  final_away_score   INTEGER,
  scoring_version    INTEGER,
  settled_at         INTEGER,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);

CREATE INDEX fixture_scoring_state_due
ON fixture_scoring_state (state, next_check_at);

-- The one active v1 competition. API-Football league id 253 is MLS.
INSERT INTO competitions (api_football_league_id, name, season, kind, is_active)
VALUES (253, 'MLS', 2026, 'league', 1);
