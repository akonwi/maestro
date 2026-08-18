-- A login attempt bridges authentication across browser contexts. The context
-- that opens the email link approves the attempt; the originating context uses
-- its private claim token to receive the resulting session.
CREATE TABLE login_attempts (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  claim_token   TEXT NOT NULL UNIQUE,
  code          TEXT NOT NULL,
  magic_token   TEXT NOT NULL UNIQUE REFERENCES magic_links(token) ON DELETE CASCADE,
  expires_at    INTEGER NOT NULL,
  code_attempts INTEGER NOT NULL DEFAULT 0,
  approved_at   INTEGER,
  session_token TEXT REFERENCES sessions(token) ON DELETE SET NULL
);
