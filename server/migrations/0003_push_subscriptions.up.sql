-- Web Push subscriptions. One row per browser endpoint; a user can hold
-- several (phone + laptop). Endpoint URLs are unique per browser
-- registration, so they are the natural key. Notification *type*
-- preferences (settlement, kickoff reminders, weekly summaries) are a
-- future table keyed by user, not stored here.
CREATE TABLE push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
