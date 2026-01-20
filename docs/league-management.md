# League Management

Users can control which leagues appear in the "juice" (value bets) results on the index page.

## League States

A league can be in one of three states:

| State | In Backend List? | `hidden` Value | Description |
|-------|------------------|----------------|-------------|
| **None** | No | N/A | User has no preference for this league |
| **Followed** | Yes | `false` | League is actively tracked and included in juice results |
| **Hidden** | Yes | `true` | League is explicitly hidden from juice results |

## UI Components

### LeagueMenu Component

Location: `web/src/components/league-menu.tsx`

A reusable component that provides league follow/hide controls. Supports two trigger modes:

**Context Menu Mode** (`trigger="context"`):
- Wraps content and shows menu on right-click/long-press
- Accepts `as` prop to render trigger as different elements (e.g., `as="tr"` for table rows)
- Used on index page for fixture cards and table rows

**Dropdown Mode** (`trigger="dropdown"`):
- Renders a settings gear button with dropdown menu
- Used on matchup page header

### Menu Options by State

| Current State | Available Actions |
|--------------|-------------------|
| None | "Follow League" + "Hide League" |
| Followed | "Hide League" only |
| Hidden | "Follow League" only |

## API Integration

Uses hooks from `web/src/api/leagues.ts`:

- `leaguesQueryOptions` - Fetches list of tracked leagues to determine current state
- `useTrackLeague` - Creates new league record (for leagues not yet tracked)
- `useToggleLeague` - Updates existing league's hidden status

## Where Controls Appear

1. **Index Page** (`web/src/routes/index.tsx`):
   - Mobile list view: Right-click/long-press fixture cards
   - Desktop table view: Right-click table rows

2. **Matchup Page** (`web/src/routes/matchup/[id].tsx`):
   - Settings gear icon in header (top-right, next to league name and date)

## Read-Only Mode

When no API token is set (`auth.isReadOnly()` returns true), the menu options are hidden since mutations would fail.
