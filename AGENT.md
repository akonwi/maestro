This project is a single page web app for managing and viewing soccer statistics.

# Technology
The technology stack is Preact, tailwindcss, daisyUI (https://daisyui.com/), and Typescript.

* Use DaisyUI components where possible. Only create one from scratch if there isn't support DaisyUI.
* Do not overuse comments in the code. limit comments to dense blocks of code that are hard to understand

# Product Requirements

## Add teams
A user can add teams to the database.
 - only team name required
A user can view/find teams and select one to see details.

## Record matches
A user can log matches
- choose date
- select home team
- select away team
- enter score

## View overall team stats
In a team's overview, some key metrics will be displayed
- # of games
- W-L-D record
- # of goals against
- # of goals for
- Goal difference
- cleansheet ratio
- average goals for
- average goals against

## Data storage
To begin simply and capture the core UX, all data will be stored in the browser using indexedDB.
