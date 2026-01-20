# Unfollow Leagues (Remove Preference)

## Problem

Currently league management is binary once a league is in the database. Users can only toggle between "followed" and "hidden" states. There's no way to return to the "no preference" state (remove the league from the database entirely).

**Current states:**

| State | In DB? | `hidden` | Behavior |
|-------|--------|----------|----------|
| No preference | No | N/A | Neutral - not tracked |
| Followed | Yes | `false` | Actively synced, included in juice |
| Hidden | Yes | `true` | Explicitly excluded from juice |

**The distinction matters:**
- **Hidden** = "I don't want to see this league" (active exclusion from juice)
- **No preference** = "I have no opinion on this league" (neutral)

## Proposed Solution

Add an "Unfollow" action that deletes the league from the database.

### Backend

Add a `DELETE /leagues/:id` endpoint:

```ard
http::Method::Del => {
  match is_authorized(req.headers.get(X_API_TOKEN)) {
    true => {
      let id = try Int::from_str(req.path_param("id")) -> _ { not_found }
      try leagues::delete(conn, id) -> internal_error
      no_content()
    },
    false => unauthorized()
  }
}
```

Add `delete` function to `leagues.ard`:

```ard
fn delete(db: sql::Database, id: Int) Void!Str {
  db.query("DELETE FROM leagues WHERE id = @id").run(["id": id])
}
```

### Frontend

Update `LeagueMenu` component to show three options when league is followed or hidden:
- "Follow League" (when hidden)
- "Hide League" (when followed or no preference)
- "Unfollow" (when followed or hidden) - removes from DB

Add `useUnfollowLeague` mutation to `web/src/api/leagues.ts`.

## Files to Modify

- `api/server/main.ard` - Add DELETE endpoint
- `api/server/leagues.ard` - Add delete function
- `web/src/api/leagues.ts` - Add unfollow mutation
- `web/src/components/league-menu.tsx` - Add unfollow option

## Impact

Low-medium - new endpoint and UI option, no schema changes
