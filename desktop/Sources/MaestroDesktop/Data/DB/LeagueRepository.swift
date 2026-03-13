import Foundation
import SQLite3

@MainActor
final class LeagueRepository {
    init() {
        ensureTable()
    }

    private func ensureTable() {
        guard let db = Database.shared.handle else { return }
        let sql = """
        CREATE TABLE IF NOT EXISTS leagues (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            synced_at INTEGER,
            current_season INTEGER DEFAULT 2025
        );
        """
        sqlite3_exec(db, sql, nil, nil, nil)

        // Add current_season column if it doesn't exist (migration for existing databases)
        var hasCurrentSeason = false
        var pragmaStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, "PRAGMA table_info(leagues);", -1, &pragmaStmt, nil) == SQLITE_OK {
            while sqlite3_step(pragmaStmt) == SQLITE_ROW {
                if let name = sqlite3_column_text(pragmaStmt, 1), String(cString: name) == "current_season" {
                    hasCurrentSeason = true
                    break
                }
            }
            sqlite3_finalize(pragmaStmt)
        }
        if !hasCurrentSeason {
            sqlite3_exec(db, "ALTER TABLE leagues ADD COLUMN current_season INTEGER DEFAULT 2025;", nil, nil, nil)
        }
    }

    func followedLeagues() -> [FollowedLeague] {
        guard let db = Database.shared.handle else { return [] }

        let sql = "SELECT id, name, current_season FROM leagues ORDER BY name ASC;"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        var results: [FollowedLeague] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            let id = Int(sqlite3_column_int64(statement, 0))
            let name = String(cString: sqlite3_column_text(statement, 1))
            let currentSeason = Int(sqlite3_column_int64(statement, 2))
            results.append(FollowedLeague(id: id, name: name, currentSeason: currentSeason))
        }

        sqlite3_finalize(statement)
        return results
    }

    func isFollowing(leagueId: Int) -> Bool {
        guard let db = Database.shared.handle else { return false }

        let sql = "SELECT 1 FROM leagues WHERE id = ? LIMIT 1;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return false
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))

        let found = sqlite3_step(statement) == SQLITE_ROW
        sqlite3_finalize(statement)
        return found
    }

    func follow(league: LeagueSearchResult) {
        guard let db = Database.shared.handle else { return }

        let sql = "INSERT OR IGNORE INTO leagues (id, name) VALUES (?, ?);"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return
        }

        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        sqlite3_bind_int64(statement, 1, Int64(league.league.id))
        sqlite3_bind_text(statement, 2, league.league.name, -1, transient)

        sqlite3_step(statement)
        sqlite3_finalize(statement)
    }

    func unfollow(leagueId: Int) {
        guard let db = Database.shared.handle else { return }

        let sql = "DELETE FROM leagues WHERE id = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))
        sqlite3_step(statement)
        sqlite3_finalize(statement)
    }

    func updateSyncedAt(leagueId: Int) {
        guard let db = Database.shared.handle else { return }

        let sql = "UPDATE leagues SET synced_at = ? WHERE id = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return
        }

        let now = Int64(Date().timeIntervalSince1970)
        sqlite3_bind_int64(statement, 1, now)
        sqlite3_bind_int64(statement, 2, Int64(leagueId))
        sqlite3_step(statement)
        sqlite3_finalize(statement)
    }

    func syncedAt(leagueId: Int) -> Date? {
        guard let db = Database.shared.handle else { return nil }

        let sql = "SELECT synced_at FROM leagues WHERE id = ? LIMIT 1;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))

        var result: Date?
        if sqlite3_step(statement) == SQLITE_ROW {
            let value = sqlite3_column_int64(statement, 0)
            if value > 0 {
                result = Date(timeIntervalSince1970: TimeInterval(value))
            }
        }

        sqlite3_finalize(statement)
        return result
    }

    func updateCurrentSeason(leagueId: Int, season: Int) {
        guard let db = Database.shared.handle else { return }

        let sql = "UPDATE leagues SET current_season = ? WHERE id = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return
        }

        sqlite3_bind_int64(statement, 1, Int64(season))
        sqlite3_bind_int64(statement, 2, Int64(leagueId))
        sqlite3_step(statement)
        sqlite3_finalize(statement)
    }

    func standings(leagueId: Int, season: Int) -> [StandingRow] {
        guard let db = Database.shared.handle else { return [] }

        let sql = """
        SELECT
            f.home_id,
            f.away_id,
            h.name as home_name,
            a.name as away_name,
            f.home_goals,
            f.away_goals
        FROM fixtures f
        INNER JOIN teams h ON h.id = f.home_id
        INNER JOIN teams a ON a.id = f.away_id
        WHERE f.league_id = ? AND f.season = ? AND f.finished = 1;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))
        sqlite3_bind_int64(statement, 2, Int64(season))

        var teamStats: [Int: TeamStanding] = [:]

        while sqlite3_step(statement) == SQLITE_ROW {
            let homeId = Int(sqlite3_column_int64(statement, 0))
            let awayId = Int(sqlite3_column_int64(statement, 1))
            let homeName = String(cString: sqlite3_column_text(statement, 2))
            let awayName = String(cString: sqlite3_column_text(statement, 3))
            let homeGoals = Int(sqlite3_column_int(statement, 4))
            let awayGoals = Int(sqlite3_column_int(statement, 5))

            if teamStats[homeId] == nil {
                teamStats[homeId] = TeamStanding(teamId: homeId, teamName: homeName)
            }
            if teamStats[awayId] == nil {
                teamStats[awayId] = TeamStanding(teamId: awayId, teamName: awayName)
            }

            teamStats[homeId]?.addMatch(goalsFor: homeGoals, goalsAgainst: awayGoals)
            teamStats[awayId]?.addMatch(goalsFor: awayGoals, goalsAgainst: homeGoals)
        }

        sqlite3_finalize(statement)

        let sorted = teamStats.values.sorted { a, b in
            if a.points != b.points { return a.points > b.points }
            if a.goalDifference != b.goalDifference { return a.goalDifference > b.goalDifference }
            return a.goalsFor > b.goalsFor
        }

        return sorted.enumerated().map { index, standing in
            StandingRow(
                position: index + 1,
                teamId: standing.teamId,
                teamName: standing.teamName,
                played: standing.played,
                won: standing.won,
                drawn: standing.drawn,
                lost: standing.lost,
                goalsFor: standing.goalsFor,
                goalsAgainst: standing.goalsAgainst,
                goalDifference: standing.goalDifference,
                points: standing.points
            )
        }
    }

    func teamPosition(teamId: Int, leagueId: Int, season: Int) -> Int? {
        let standings = self.standings(leagueId: leagueId, season: season)
        return standings.first { $0.teamId == teamId }?.position
    }
}

private struct TeamStanding {
    let teamId: Int
    let teamName: String
    var played = 0
    var won = 0
    var drawn = 0
    var lost = 0
    var goalsFor = 0
    var goalsAgainst = 0

    var goalDifference: Int { goalsFor - goalsAgainst }
    var points: Int { won * 3 + drawn }

    mutating func addMatch(goalsFor gf: Int, goalsAgainst ga: Int) {
        played += 1
        goalsFor += gf
        goalsAgainst += ga
        if gf > ga {
            won += 1
        } else if gf < ga {
            lost += 1
        } else {
            drawn += 1
        }
    }
}

struct FollowedLeague: Identifiable, Equatable {
    let id: Int
    let name: String
    let currentSeason: Int
}
