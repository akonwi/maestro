Maestro started as a way to use (validate) my programming language [Ard](https://ard.run) to build a web server doing semi-complicated stuff.
Since, then it's turned into something actually useful (to me at least) as a browser of soccer statistics that I'm interested in.
It's also been a fun project to play with some new ideas and technologies lke Solid.js, coding agents, and sqlite.

This repo contains both the frontend and backend source code:

./api - the web server written in Ard
- uses sqlite for all storage
- has background jobs
  * saves fixture data for leagues i'm most interested in
  * updates the outcomes of pending bets based on match results
  * picks out (poorly determined) good lines to bet on daily
- provides a JSON API for the frontend

./web - the SolidStart web app deployed to GitHub pages (akonwi.io/maestro)
