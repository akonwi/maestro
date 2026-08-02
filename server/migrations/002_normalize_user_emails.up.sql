-- Reconcile identities created before email normalization became mandatory.
CREATE TEMP TABLE user_email_merges AS
SELECT duplicate.id AS duplicate_id, canonical.id AS canonical_id
FROM users duplicate
JOIN users canonical
  ON lower(trim(duplicate.email)) = lower(trim(canonical.email))
 AND canonical.id = (
   SELECT MIN(candidate.id)
   FROM users candidate
   WHERE lower(trim(candidate.email)) = lower(trim(duplicate.email))
 )
WHERE duplicate.id <> canonical.id;

UPDATE sessions
SET user_id = (
  SELECT canonical_id FROM user_email_merges WHERE duplicate_id = sessions.user_id
)
WHERE user_id IN (SELECT duplicate_id FROM user_email_merges);

UPDATE groups
SET owner_id = (
  SELECT canonical_id FROM user_email_merges WHERE duplicate_id = groups.owner_id
)
WHERE owner_id IN (SELECT duplicate_id FROM user_email_merges);

INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at)
SELECT memberships.group_id, merges.canonical_id, memberships.joined_at
FROM group_members memberships
JOIN user_email_merges merges ON merges.duplicate_id = memberships.user_id;

DELETE FROM group_members
WHERE user_id IN (SELECT duplicate_id FROM user_email_merges);

UPDATE OR IGNORE predictions
SET user_id = (
  SELECT canonical_id FROM user_email_merges WHERE duplicate_id = predictions.user_id
)
WHERE user_id IN (SELECT duplicate_id FROM user_email_merges);

DELETE FROM predictions
WHERE user_id IN (SELECT duplicate_id FROM user_email_merges);

DELETE FROM users
WHERE id IN (SELECT duplicate_id FROM user_email_merges);

UPDATE users SET email = lower(trim(email));

DROP TABLE user_email_merges;

CREATE UNIQUE INDEX users_normalized_email_unique
ON users (lower(trim(email)));
