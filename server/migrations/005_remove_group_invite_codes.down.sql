PRAGMA foreign_keys = OFF;

ALTER TABLE group_members RENAME TO group_members_without_invite_codes;
ALTER TABLE groups RENAME TO groups_without_invite_codes;

CREATE TABLE groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id),
  invite_code TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

INSERT INTO groups (id, name, owner_id, invite_code, created_at)
SELECT id, name, owner_id, 'legacy-' || id, created_at FROM groups_without_invite_codes;

CREATE TABLE group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id),
  user_id   INTEGER NOT NULL REFERENCES users(id),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

INSERT INTO group_members (group_id, user_id, joined_at)
SELECT group_id, user_id, joined_at FROM group_members_without_invite_codes;

DROP TABLE group_members_without_invite_codes;
DROP TABLE groups_without_invite_codes;

PRAGMA foreign_keys = ON;
