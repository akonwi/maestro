-- Competitions become unique leagues: one row per API-Football league id,
-- with the current season resolved at runtime from the provider instead of
-- being part of the row's identity. Season history moves to
-- fixture_scoring_state.season.

-- 1. Record each scoring state's season while the old rows still carry it.
ALTER TABLE fixture_scoring_state ADD COLUMN season INTEGER;

UPDATE fixture_scoring_state
SET season = (
  SELECT c.season FROM competitions c
  WHERE c.id = fixture_scoring_state.competition_id
);

-- 2. Remap scoring states from duplicate league rows to the canonical
-- (lowest-id) row per league.
UPDATE fixture_scoring_state
SET competition_id = (
  SELECT MIN(c2.id) FROM competitions c2
  WHERE c2.api_football_league_id = (
    SELECT c.api_football_league_id FROM competitions c
    WHERE c.id = fixture_scoring_state.competition_id
  )
);

-- 3. Rebuild competitions without the season column. The canonical row
-- keeps the latest name/kind, and is active if any season row was active.
CREATE TABLE competitions_new (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  api_football_league_id INTEGER NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  kind                   TEXT NOT NULL,
  is_active              INTEGER NOT NULL DEFAULT 1
);

INSERT INTO competitions_new (id, api_football_league_id, name, kind, is_active)
SELECT
  MIN(c.id),
  c.api_football_league_id,
  (
    SELECT c2.name FROM competitions c2
    WHERE c2.api_football_league_id = c.api_football_league_id
    ORDER BY c2.season DESC LIMIT 1
  ),
  (
    SELECT c2.kind FROM competitions c2
    WHERE c2.api_football_league_id = c.api_football_league_id
    ORDER BY c2.season DESC LIMIT 1
  ),
  MAX(c.is_active)
FROM competitions c
GROUP BY c.api_football_league_id;

DROP TABLE competitions;
ALTER TABLE competitions_new RENAME TO competitions;
