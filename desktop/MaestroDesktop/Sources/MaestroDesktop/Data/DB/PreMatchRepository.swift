import Foundation
import SQLite3

@MainActor
final class PreMatchRepository {

    func preMatchData(for fixture: FixtureSummary, scope: FormScope) -> PreMatchData? {
        let homeStats = teamStats(teamId: fixture.homeId, teamName: fixture.homeName, leagueId: fixture.leagueId, excludeFixtureId: fixture.id, scope: scope)
        let awayStats = teamStats(teamId: fixture.awayId, teamName: fixture.awayName, leagueId: fixture.leagueId, excludeFixtureId: fixture.id, scope: scope)

        return PreMatchData(home: homeStats, away: awayStats)
    }

    private func teamStats(teamId: Int, teamName: String, leagueId: Int, excludeFixtureId: Int, scope: FormScope) -> TeamPreMatchStats {
        let limit: Int? = scope == .last5 ? 5 : nil
        let form = recentForm(teamId: teamId, leagueId: leagueId, limit: limit, excludeFixtureId: excludeFixtureId)
        let fixtureIds = form.map { $0.id }
        let season = scopedStats(teamId: teamId, leagueId: leagueId, fixtureIds: fixtureIds)

        return TeamPreMatchStats(
            teamId: teamId,
            teamName: teamName,
            form: form,
            seasonStats: season
        )
    }

    private func recentForm(teamId: Int, leagueId: Int, limit: Int?, excludeFixtureId: Int) -> [FormResult] {
        guard let db = Database.shared.handle else { return [] }

        let limitClause = limit != nil ? "LIMIT ?" : ""
        let sql = """
        SELECT
            f.id,
            f.timestamp,
            f.home_id,
            f.away_id,
            f.home_goals,
            f.away_goals,
            h.name as home_name,
            a.name as away_name
        FROM fixtures f
        INNER JOIN teams h ON h.id = f.home_id
        INNER JOIN teams a ON a.id = f.away_id
        WHERE f.league_id = ?
          AND (f.home_id = ? OR f.away_id = ?)
          AND f.finished = 1
          AND f.id != ?
        ORDER BY f.timestamp DESC
        \(limitClause);
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))
        sqlite3_bind_int64(statement, 2, Int64(teamId))
        sqlite3_bind_int64(statement, 3, Int64(teamId))
        sqlite3_bind_int64(statement, 4, Int64(excludeFixtureId))
        if let limit = limit {
            sqlite3_bind_int64(statement, 5, Int64(limit))
        }

        var results: [FormResult] = []

        while sqlite3_step(statement) == SQLITE_ROW {
            let fixtureId = Int(sqlite3_column_int64(statement, 0))
            let timestamp = sqlite3_column_int64(statement, 1)
            let homeId = Int(sqlite3_column_int64(statement, 2))
            let awayId = Int(sqlite3_column_int64(statement, 3))
            let homeGoals = Int(sqlite3_column_int(statement, 4))
            let awayGoals = Int(sqlite3_column_int(statement, 5))
            let homeName = String(cString: sqlite3_column_text(statement, 6))
            let awayName = String(cString: sqlite3_column_text(statement, 7))

            let isHome = homeId == teamId
            let opponent = isHome ? awayName : homeName
            let goalsFor = isHome ? homeGoals : awayGoals
            let goalsAgainst = isHome ? awayGoals : homeGoals

            let result = FormResult(
                id: fixtureId,
                opponent: opponent,
                isHome: isHome,
                goalsFor: goalsFor,
                goalsAgainst: goalsAgainst,
                date: Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000)
            )

            results.append(result)
        }

        sqlite3_finalize(statement)
        return results
    }

    private func scopedStats(teamId: Int, leagueId: Int, fixtureIds: [Int]) -> SeasonStats {
        guard let db = Database.shared.handle, !fixtureIds.isEmpty else { return .empty }

        let placeholders = fixtureIds.map { _ in "?" }.joined(separator: ", ")

        // Get match results for specified fixtures
        let matchSql = """
        SELECT
            f.home_id,
            f.home_goals,
            f.away_goals
        FROM fixtures f
        WHERE f.id IN (\(placeholders));
        """

        var matchStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, matchSql, -1, &matchStmt, nil) != SQLITE_OK {
            return .empty
        }

        for (index, fixtureId) in fixtureIds.enumerated() {
            sqlite3_bind_int64(matchStmt, Int32(index + 1), Int64(fixtureId))
        }

        var played = 0
        var wins = 0
        var draws = 0
        var losses = 0
        var goalsFor = 0
        var goalsAgainst = 0
        var cleanSheets = 0

        while sqlite3_step(matchStmt) == SQLITE_ROW {
            let homeId = Int(sqlite3_column_int64(matchStmt, 0))
            let homeGoals = Int(sqlite3_column_int(matchStmt, 1))
            let awayGoals = Int(sqlite3_column_int(matchStmt, 2))

            let isHome = homeId == teamId
            let gf = isHome ? homeGoals : awayGoals
            let ga = isHome ? awayGoals : homeGoals

            played += 1
            goalsFor += gf
            goalsAgainst += ga

            if ga == 0 { cleanSheets += 1 }

            if gf > ga { wins += 1 }
            else if gf < ga { losses += 1 }
            else { draws += 1 }
        }

        sqlite3_finalize(matchStmt)

        // Get aggregated stats from fixture_stats for specified fixtures
        let statsSql = """
        SELECT
            SUM(shots) as total_shots,
            SUM(shots_on_goal) as total_sog,
            SUM(corners) as total_corners,
            SUM(possession) as total_possession,
            SUM(xg) as total_xg,
            COUNT(*) as count
        FROM fixture_stats
        WHERE team_id = ? AND fixture_id IN (\(placeholders));
        """

        var statsStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, statsSql, -1, &statsStmt, nil) != SQLITE_OK {
            return SeasonStats(
                played: played, wins: wins, draws: draws, losses: losses,
                goalsFor: goalsFor, goalsAgainst: goalsAgainst,
                xgFor: 0, xgAgainst: 0, cleanSheets: cleanSheets,
                shotsPerGame: 0, shotsOnTargetPerGame: 0, cornersPerGame: 0, possessionAvg: 0
            )
        }

        sqlite3_bind_int64(statsStmt, 1, Int64(teamId))
        for (index, fixtureId) in fixtureIds.enumerated() {
            sqlite3_bind_int64(statsStmt, Int32(index + 2), Int64(fixtureId))
        }

        var totalShots = 0
        var totalSog = 0
        var totalCorners = 0
        var totalPossession = 0.0
        var totalXg = 0.0
        var statsCount = 0

        if sqlite3_step(statsStmt) == SQLITE_ROW {
            totalShots = Int(sqlite3_column_int(statsStmt, 0))
            totalSog = Int(sqlite3_column_int(statsStmt, 1))
            totalCorners = Int(sqlite3_column_int(statsStmt, 2))
            totalPossession = sqlite3_column_double(statsStmt, 3)
            totalXg = sqlite3_column_double(statsStmt, 4)
            statsCount = Int(sqlite3_column_int(statsStmt, 5))
        }

        sqlite3_finalize(statsStmt)

        // Get xG against (from opponent stats in same fixtures)
        let xgAgainstSql = """
        SELECT SUM(fs2.xg)
        FROM fixture_stats fs1
        INNER JOIN fixture_stats fs2 ON fs1.fixture_id = fs2.fixture_id AND fs1.team_id != fs2.team_id
        WHERE fs1.team_id = ? AND fs1.fixture_id IN (\(placeholders));
        """

        var xgaStmt: OpaquePointer?
        var xgAgainst = 0.0

        if sqlite3_prepare_v2(db, xgAgainstSql, -1, &xgaStmt, nil) == SQLITE_OK {
            sqlite3_bind_int64(xgaStmt, 1, Int64(teamId))
            for (index, fixtureId) in fixtureIds.enumerated() {
                sqlite3_bind_int64(xgaStmt, Int32(index + 2), Int64(fixtureId))
            }

            if sqlite3_step(xgaStmt) == SQLITE_ROW {
                xgAgainst = sqlite3_column_double(xgaStmt, 0)
            }
            sqlite3_finalize(xgaStmt)
        }

        let gamesPlayed = max(statsCount, 1)

        return SeasonStats(
            played: played,
            wins: wins,
            draws: draws,
            losses: losses,
            goalsFor: goalsFor,
            goalsAgainst: goalsAgainst,
            xgFor: totalXg,
            xgAgainst: xgAgainst,
            cleanSheets: cleanSheets,
            shotsPerGame: Double(totalShots) / Double(gamesPlayed),
            shotsOnTargetPerGame: Double(totalSog) / Double(gamesPlayed),
            cornersPerGame: Double(totalCorners) / Double(gamesPlayed),
            possessionAvg: totalPossession / Double(gamesPlayed)
        )
    }
}
