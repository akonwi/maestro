# Soccer Statistics App Development Plan

## Phase 1: Basic UI Structure & Types ✅

- [x] Set up TypeScript interfaces/types
  - [x] Team interface
  - [x] Match interface
  - [x] Statistics interface
- [x] Set up main app layout using DaisyUI
- [x] Create navigation/routing structure
- [x] Add responsive design foundation

## Phase 2: Foundation & Data Layer ✅

- [x] Set up IndexedDB database structure
  - [x] Teams table (id, name, created_at)
  - [x] Matches table (id, date, homeId, awayId, home_score, away_score, created_at)
- [x] Create database utility functions
  - [x] Initialize database
  - [x] CRUD operations for teams
  - [x] CRUD operations for matches

## Phase 3: Team Management ✅

- [x] Create "Add Team" form
  - [x] Input field for team name
  - [x] Form validation
  - [x] Save to IndexedDB
- [x] Create teams list/grid view
  - [x] Display all teams
  - [x] Search/filter functionality
- [x] Create team detail page
  - [x] Basic team info display
  - [x] Navigation from teams list

## Phase 4: Match Recording

- [ ] Create "Add Match" form
  - [ ] Date picker
  - [ ] Home team dropdown/selector
  - [ ] Away team dropdown/selector
  - [ ] Score inputs (home/away)
  - [ ] Form validation
  - [ ] Save to IndexedDB
- [ ] Create matches list view
  - [ ] Display recent matches
  - [ ] Filter by team/date

## Phase 5: Statistics & Analytics

- [ ] Create statistics calculation functions
  - [ ] Games played count
  - [ ] Win-Loss-Draw record
  - [ ] Goals for/against totals
  - [ ] Goal difference
  - [ ] Clean sheet ratio
  - [ ] Average goals for/against
- [ ] Integrate stats into team detail pages
- [ ] Create overall statistics dashboard

## Phase 6: Polish & UX

- [ ] Add loading states
- [ ] Error handling and user feedback
- [ ] Data validation and edge cases
- [ ] Mobile responsiveness testing
- [ ] Performance optimization

## Technical Notes

- Use DaisyUI components throughout
- Minimize custom CSS where possible
- Keep IndexedDB operations async
- Consider adding data export/import features later
