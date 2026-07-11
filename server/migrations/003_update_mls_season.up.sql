-- Existing databases were seeded with the completed 2025 season.
UPDATE competitions
SET season = 2026
WHERE api_football_league_id = 253
  AND season = 2025;
