CREATE TABLE fixture_scoring_state (
  fixture_id INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  kickoff_at INTEGER NOT NULL,
  prediction_lock_at INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'settled', 'void')),
  provider_status TEXT,
  next_check_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_checked_at INTEGER,
  last_error TEXT,
  final_home_score INTEGER,
  final_away_score INTEGER,
  scoring_version INTEGER,
  settled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX fixture_scoring_state_due
ON fixture_scoring_state (state, next_check_at);
