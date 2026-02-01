import Foundation
import SQLite3

@MainActor
final class FixtureRepository {
    func latestFixtureDate() -> Date? {
        guard let db = Database.shared.handle else { return nil }

        let sql = "SELECT MAX(timestamp) FROM fixtures;"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        var result: Date?
        if sqlite3_step(statement) == SQLITE_ROW {
            let value = sqlite3_column_int64(statement, 0)
            if value > 0 {
                result = Date(timeIntervalSince1970: TimeInterval(value) / 1000)
            }
        }

        sqlite3_finalize(statement)
        return result
    }

    func fixturesGroupedByLeague(for date: Date) -> [LeagueSection] {
        guard let db = Database.shared.handle else { return [] }

        let start = Calendar.current.startOfDay(for: date)
        let end = Calendar.current.date(byAdding: .day, value: 1, to: start) ?? start
        let startMs = Int64(start.timeIntervalSince1970 * 1000)
        let endMs = Int64(end.timeIntervalSince1970 * 1000)


        let sql = """
        SELECT
          f.id,
          f.league_id,
          l.name as league_name,
          f.timestamp,
          f.finished,
          f.home_id,
          f.away_id,
          h.name as home_name,
          a.name as away_name,
          f.home_goals,
          f.away_goals
        FROM fixtures f
        INNER JOIN leagues l ON l.id = f.league_id
        INNER JOIN teams h ON h.id = f.home_id
        INNER JOIN teams a ON a.id = f.away_id
        WHERE f.timestamp >= ? AND f.timestamp < ?
        ORDER BY l.name ASC, f.timestamp ASC;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        sqlite3_bind_int64(statement, 1, startMs)
        sqlite3_bind_int64(statement, 2, endMs)

        var leagueOrder: [Int] = []
        var leagueMap: [Int: (name: String, fixtures: [FixtureSummary])] = [:]

        while sqlite3_step(statement) == SQLITE_ROW {
            let fixtureId = Int(sqlite3_column_int64(statement, 0))
            let leagueId = Int(sqlite3_column_int64(statement, 1))
            let leagueName = String(cString: sqlite3_column_text(statement, 2))
            let timestamp = Int64(sqlite3_column_int64(statement, 3))
            let finished = sqlite3_column_int(statement, 4) == 1
            let homeId = Int(sqlite3_column_int64(statement, 5))
            let awayId = Int(sqlite3_column_int64(statement, 6))
            let homeName = String(cString: sqlite3_column_text(statement, 7))
            let awayName = String(cString: sqlite3_column_text(statement, 8))
            let homeGoals = Int(sqlite3_column_int(statement, 9))
            let awayGoals = Int(sqlite3_column_int(statement, 10))

            let kickoff = Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000)
            let status = finished ? "FT" : "NS"

            let fixture = FixtureSummary(
                id: fixtureId,
                leagueId: leagueId,
                homeId: homeId,
                awayId: awayId,
                homeName: homeName,
                awayName: awayName,
                status: status,
                kickoff: kickoff,
                homeGoals: homeGoals,
                awayGoals: awayGoals
            )

            if leagueMap[leagueId] == nil {
                leagueOrder.append(leagueId)
                leagueMap[leagueId] = (name: leagueName, fixtures: [])
            }

            leagueMap[leagueId]?.fixtures.append(fixture)
        }

        sqlite3_finalize(statement)

        return leagueOrder.compactMap { id in
            guard let entry = leagueMap[id] else { return nil }
            return LeagueSection(id: id, name: entry.name, fixtures: entry.fixtures)
        }
    }

    func stats(for fixtureId: Int, homeId: Int, awayId: Int) -> FixtureStats? {
        guard let db = Database.shared.handle else { return nil }

        let sql = """
        SELECT
            team_id, shots, shots_on_goal, possession, passes, passes_completed,
            fouls, corners, offsides, yellow_cards, red_cards, xg
        FROM fixture_stats
        WHERE fixture_id = ?;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        sqlite3_bind_int64(statement, 1, Int64(fixtureId))

        var homeStats: TeamStats?
        var awayStats: TeamStats?

        while sqlite3_step(statement) == SQLITE_ROW {
            let teamId = Int(sqlite3_column_int64(statement, 0))
            let shots = Int(sqlite3_column_int(statement, 1))
            let shotsOnGoal = Int(sqlite3_column_int(statement, 2))
            let possession = sqlite3_column_double(statement, 3)
            let passes = Int(sqlite3_column_int(statement, 4))
            let passesCompleted = Int(sqlite3_column_int(statement, 5))
            let fouls = Int(sqlite3_column_int(statement, 6))
            let corners = Int(sqlite3_column_int(statement, 7))
            let offsides = Int(sqlite3_column_int(statement, 8))
            let yellowCards = Int(sqlite3_column_int(statement, 9))
            let redCards = Int(sqlite3_column_int(statement, 10))
            let xg = sqlite3_column_double(statement, 11)

            let stats = TeamStats(
                teamId: teamId,
                shots: shots,
                shotsOnGoal: shotsOnGoal,
                possession: possession,
                passes: passes,
                passesCompleted: passesCompleted,
                fouls: fouls,
                corners: corners,
                offsides: offsides,
                yellowCards: yellowCards,
                redCards: redCards,
                xg: xg
            )

            if teamId == homeId {
                homeStats = stats
            } else if teamId == awayId {
                awayStats = stats
            }
        }

        sqlite3_finalize(statement)

        guard let home = homeStats, let away = awayStats else {
            return nil
        }

        return FixtureStats(home: home, away: away)
    }
}
