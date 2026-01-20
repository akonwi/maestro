# Track League Sync Errors

## Problem

When fixture sync fails for a league, there's no persistent record of the error. The error is logged but lost. This makes it difficult to identify leagues with ongoing sync problems.

## Location

`api/server/fixtures.ard` line 638

```ard
err => {
  io::print("Failed to import (league_id={league_id}, season={season}): {err}")
  // todo: indicate sync error on leagues table
}
```

## Proposed Solution

Add columns to the leagues table to track sync status:

### Migration

```sql
ALTER TABLE leagues ADD COLUMN last_sync_at INTEGER;
ALTER TABLE leagues ADD COLUMN last_sync_error TEXT;
```

### Code Changes

Update `sync_season()` to record sync results:

```ard
fn record_sync_success(db: sql::Database, league_id: Int) {
  db.query("UPDATE leagues SET last_sync_at = @now, last_sync_error = NULL WHERE id = @id")
    .run(["id": league_id, "now": dates::now()])
}

fn record_sync_error(db: sql::Database, league_id: Int, error: Str) {
  db.query("UPDATE leagues SET last_sync_at = @now, last_sync_error = @error WHERE id = @id")
    .run(["id": league_id, "now": dates::now(), "error": error])
}
```

### Optional: Expose in API

Add sync status to the `/leagues` endpoint response so the frontend can display sync health.

## Files to Modify

- `api/server/migrations/` (new migration)
- `api/server/fixtures.ard`
- `api/server/leagues.ard` (update struct and queries)
- Optionally: `web/src/routes/leagues.tsx` (display sync status)

## Impact

Medium - requires schema change, improves operational visibility
