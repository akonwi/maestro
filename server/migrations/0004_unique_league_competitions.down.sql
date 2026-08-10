-- Best-effort reversal: restore the (league, season) shape from scoring
-- state seasons. Rows for seasons with no scoring history cannot be
-- reconstructed.
CREATE TABLE competitions_old (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  api_football_league_id INTEGER NOT NULL,
  name                   TEXT NOT NULL,
  season                 INTEGER NOT NULL,
  kind                   TEXT NOT NULL,
  is_active              INTEGER NOT NULL DEFAULT 1,
  UNIQUE (api_football_league_id, season)
);

INSERT INTO competitions_old (api_football_league_id, name, season, kind, is_active)
SELECT DISTINCT c.api_football_league_id, c.name, COALESCE(s.season, 0), c.kind, c.is_active
FROM competitions c
LEFT JOIN fixture_scoring_state s ON s.competition_id = c.id;

DROP TABLE competitions;
ALTER TABLE competitions_old RENAME TO competitions;

-- SQLite (3.35+) supports dropping a plain column.
ALTER TABLE fixture_scoring_state DROP COLUMN season;
