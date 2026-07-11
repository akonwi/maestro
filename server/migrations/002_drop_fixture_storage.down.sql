CREATE TABLE teams (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE fixtures (
  id INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  kickoff_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER
);

CREATE INDEX idx_fixtures_competition ON fixtures(competition_id);
CREATE INDEX idx_fixtures_kickoff ON fixtures(kickoff_at);

DROP INDEX IF EXISTS idx_predictions_fixture;
DROP TABLE predictions;

CREATE TABLE predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, fixture_id)
);

CREATE INDEX idx_predictions_fixture ON predictions(fixture_id);
