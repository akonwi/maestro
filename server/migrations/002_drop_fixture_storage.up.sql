-- v1 proxies API-Football and stores only game-owned data. Fixture ids are
-- stable upstream ids, so predictions do not need a local fixtures FK.

DROP INDEX IF EXISTS idx_predictions_fixture;
DROP TABLE predictions;

CREATE TABLE predictions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  fixture_id INTEGER NOT NULL,               -- API-Football fixture id
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points     INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (user_id, fixture_id)
);

CREATE INDEX idx_predictions_fixture ON predictions(fixture_id);

DROP TABLE IF EXISTS fixtures;
DROP TABLE IF EXISTS teams;
