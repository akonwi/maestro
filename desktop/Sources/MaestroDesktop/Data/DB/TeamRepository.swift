import Foundation
import SQLite3

@MainActor
final class TeamRepository {
    private let formLimit = 5
    
    func teamLeagues(teamId: Int, season: Int) -> [TeamLeague] {
        guard let db = Database.shared.handle else { return [] }
        
        let sql = """
        SELECT DISTINCT f.league_id, l.name
        FROM fixtures f
        INNER JOIN leagues l ON l.id = f.league_id
        WHERE (f.home_id = ? OR f.away_id = ?) 
          AND f.season = ?
        ORDER BY l.name ASC;
        """
        
        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }
        
        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(teamId))
        sqlite3_bind_int64(statement, 3, Int64(season))
        
        var results: [TeamLeague] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            let leagueId = Int(sqlite3_column_int64(statement, 0))
            let leagueName = String(cString: sqlite3_column_text(statement, 1))
            results.append(TeamLeague(id: leagueId, name: leagueName))
        }
        
        sqlite3_finalize(statement)
        return results
    }

    func teamDetails(teamId: Int, competitionFilter: TeamTab.TeamCompetitionFilter, season: Int) -> TeamDetails? {
        guard let db = Database.shared.handle else { return nil }

        guard let teamName = getTeamName(teamId: teamId, db: db) else { return nil }

        let fixtures: [FixtureData]
        let contextName: String
        
        switch competitionFilter {
        case .all:
            fixtures = getTeamFixturesAllLeagues(teamId: teamId, season: season, db: db)
            contextName = "All Competitions"
        case .specific(let leagueId):
            fixtures = getTeamFixtures(teamId: teamId, leagueId: leagueId, season: season, db: db)
            contextName = getLeagueName(leagueId: leagueId, db: db) ?? "Unknown League"
        }
        
        let finishedFixtures = fixtures.filter { $0.isFinished }
        let formFixtures = Array(finishedFixtures.suffix(formLimit))

        // Season records
        let seasonRecord = TeamRecordSplit(
            overall: computeRecord(teamId: teamId, fixtures: finishedFixtures),
            home: computeRecord(teamId: teamId, fixtures: finishedFixtures.filter { $0.homeId == teamId }),
            away: computeRecord(teamId: teamId, fixtures: finishedFixtures.filter { $0.awayId == teamId })
        )

        // Form records (last 5)
        let formRecord = TeamRecordSplit(
            overall: computeRecord(teamId: teamId, fixtures: formFixtures),
            home: computeRecord(teamId: teamId, fixtures: formFixtures.filter { $0.homeId == teamId }),
            away: computeRecord(teamId: teamId, fixtures: formFixtures.filter { $0.awayId == teamId })
        )

        let form = computeForm(teamId: teamId, fixtures: finishedFixtures.suffix(formLimit))
        let allFixtures = computeAllFixtures(teamId: teamId, fixtures: fixtures)
        let nextFixture = fixtures.first { !$0.isFinished }.map { f in
            FixtureSummary(
                id: f.id,
                leagueId: f.leagueId,
                season: f.season,
                homeId: f.homeId,
                awayId: f.awayId,
                homeName: f.homeName,
                awayName: f.awayName,
                status: "NS",
                kickoff: Date(timeIntervalSince1970: TimeInterval(f.timestamp) / 1000),
                homeGoals: f.homeGoals,
                awayGoals: f.awayGoals
            )
        }

        // Metrics (team vs opponents)
        let seasonMetrics = computeMetricsComparison(teamId: teamId, fixtures: finishedFixtures, db: db)
        let formMetrics = computeMetricsComparisonForFixtures(teamId: teamId, fixtures: formFixtures, db: db)

        return TeamDetails(
            teamId: teamId,
            teamName: teamName,
            leagueId: competitionFilter.leagueId ?? 0,
            leagueName: contextName,
            season: season,
            seasonRecord: seasonRecord,
            formRecord: formRecord,
            form: form,
            allFixtures: allFixtures,
            nextFixture: nextFixture,
            seasonMetrics: seasonMetrics,
            formMetrics: formMetrics
        )
    }

    private func getTeamName(teamId: Int, db: OpaquePointer) -> String? {
        let sql = "SELECT name FROM teams WHERE id = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))

        var name: String?
        if sqlite3_step(statement) == SQLITE_ROW {
            name = String(cString: sqlite3_column_text(statement, 0))
        }

        sqlite3_finalize(statement)
        return name
    }
    
    private func getLeagueName(leagueId: Int, db: OpaquePointer) -> String? {
        let sql = "SELECT name FROM leagues WHERE id = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))

        var name: String?
        if sqlite3_step(statement) == SQLITE_ROW {
            name = String(cString: sqlite3_column_text(statement, 0))
        }

        sqlite3_finalize(statement)
        return name
    }

    private struct FixtureData {
        let id: Int
        let homeId: Int
        let awayId: Int
        let homeName: String
        let awayName: String
        let homeGoals: Int
        let awayGoals: Int
        let timestamp: Int64
        let isFinished: Bool
        let leagueId: Int
        let season: Int
    }

    private func getTeamFixtures(teamId: Int, leagueId: Int, season: Int, db: OpaquePointer) -> [FixtureData] {
        let sql = """
        SELECT
            f.id, f.home_id, f.away_id, h.name, a.name,
            f.home_goals, f.away_goals, f.timestamp, f.finished,
            f.league_id, f.season
        FROM fixtures f
        INNER JOIN teams h ON h.id = f.home_id
        INNER JOIN teams a ON a.id = f.away_id
        WHERE (f.home_id = ? OR f.away_id = ?)
          AND f.league_id = ? AND f.season = ?
        ORDER BY f.timestamp ASC;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(teamId))
        sqlite3_bind_int64(statement, 3, Int64(leagueId))
        sqlite3_bind_int64(statement, 4, Int64(season))

        var results: [FixtureData] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            results.append(FixtureData(
                id: Int(sqlite3_column_int64(statement, 0)),
                homeId: Int(sqlite3_column_int64(statement, 1)),
                awayId: Int(sqlite3_column_int64(statement, 2)),
                homeName: String(cString: sqlite3_column_text(statement, 3)),
                awayName: String(cString: sqlite3_column_text(statement, 4)),
                homeGoals: Int(sqlite3_column_int(statement, 5)),
                awayGoals: Int(sqlite3_column_int(statement, 6)),
                timestamp: sqlite3_column_int64(statement, 7),
                isFinished: sqlite3_column_int(statement, 8) == 1,
                leagueId: Int(sqlite3_column_int64(statement, 9)),
                season: Int(sqlite3_column_int64(statement, 10))
            ))
        }

        sqlite3_finalize(statement)
        return results
    }
    
    private func getTeamFixturesAllLeagues(teamId: Int, season: Int, db: OpaquePointer) -> [FixtureData] {
        let sql = """
        SELECT
            f.id, f.home_id, f.away_id, h.name, a.name,
            f.home_goals, f.away_goals, f.timestamp, f.finished,
            f.league_id, f.season
        FROM fixtures f
        INNER JOIN teams h ON h.id = f.home_id
        INNER JOIN teams a ON a.id = f.away_id
        WHERE (f.home_id = ? OR f.away_id = ?) AND f.season = ?
        ORDER BY f.timestamp ASC;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(teamId))
        sqlite3_bind_int64(statement, 3, Int64(season))

        var results: [FixtureData] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            results.append(FixtureData(
                id: Int(sqlite3_column_int64(statement, 0)),
                homeId: Int(sqlite3_column_int64(statement, 1)),
                awayId: Int(sqlite3_column_int64(statement, 2)),
                homeName: String(cString: sqlite3_column_text(statement, 3)),
                awayName: String(cString: sqlite3_column_text(statement, 4)),
                homeGoals: Int(sqlite3_column_int(statement, 5)),
                awayGoals: Int(sqlite3_column_int(statement, 6)),
                timestamp: sqlite3_column_int64(statement, 7),
                isFinished: sqlite3_column_int(statement, 8) == 1,
                leagueId: Int(sqlite3_column_int64(statement, 9)),
                season: Int(sqlite3_column_int64(statement, 10))
            ))
        }

        sqlite3_finalize(statement)
        return results
    }

    private func computeRecord(teamId: Int, fixtures: [FixtureData]) -> TeamRecord {
        var played = 0, won = 0, drawn = 0, lost = 0
        var goalsFor = 0, goalsAgainst = 0, cleanSheets = 0

        for f in fixtures {
            played += 1
            let isHome = f.homeId == teamId
            let gf = isHome ? f.homeGoals : f.awayGoals
            let ga = isHome ? f.awayGoals : f.homeGoals

            goalsFor += gf
            goalsAgainst += ga

            if ga == 0 { cleanSheets += 1 }

            if gf > ga { won += 1 }
            else if gf < ga { lost += 1 }
            else { drawn += 1 }
        }

        return TeamRecord(
            played: played,
            won: won,
            drawn: drawn,
            lost: lost,
            goalsFor: goalsFor,
            goalsAgainst: goalsAgainst,
            cleanSheets: cleanSheets
        )
    }

    private func computeForm(teamId: Int, fixtures: ArraySlice<FixtureData>) -> [TeamFormResult] {
        fixtures.reversed().map { f in
            let isHome = f.homeId == teamId
            let gf = isHome ? f.homeGoals : f.awayGoals
            let ga = isHome ? f.awayGoals : f.homeGoals
            let opponent = isHome ? f.awayName : f.homeName

            let result: TeamFormResult.MatchResult
            if gf > ga { result = .win }
            else if gf < ga { result = .loss }
            else { result = .draw }

            return TeamFormResult(
                id: f.id,
                result: result,
                opponentId: isHome ? f.awayId : f.homeId,
                opponent: opponent,
                goalsFor: gf,
                goalsAgainst: ga,
                isHome: isHome,
                date: Date(timeIntervalSince1970: TimeInterval(f.timestamp) / 1000)
            )
        }
    }

    private func computeAllFixtures(teamId: Int, fixtures: [FixtureData]) -> [TeamFixtureResult] {
        fixtures.map { f in
            let isHome = f.homeId == teamId
            let gf = isHome ? f.homeGoals : f.awayGoals
            let ga = isHome ? f.awayGoals : f.homeGoals
            let opponent = isHome ? f.awayName : f.homeName

            return TeamFixtureResult(
                id: f.id,
                opponentId: isHome ? f.awayId : f.homeId,
                opponent: opponent,
                goalsFor: gf,
                goalsAgainst: ga,
                isHome: isHome,
                date: Date(timeIntervalSince1970: TimeInterval(f.timestamp) / 1000),
                isFinished: f.isFinished
            )
        }
    }

    private func computePerGameMetrics(teamId: Int, leagueId: Int, season: Int, matchCount: Int, db: OpaquePointer) -> TeamPerGameMetrics {
        guard matchCount > 0 else { return .empty }

        let sql = """
        SELECT
            SUM(shots), SUM(shots_on_goal), SUM(xg), SUM(corners),
            SUM(possession), SUM(passes), SUM(passes_completed)
        FROM fixture_stats
        WHERE team_id = ? AND league_id = ? AND season = ?;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return .empty
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(leagueId))
        sqlite3_bind_int64(statement, 3, Int64(season))

        var metrics = TeamPerGameMetrics.empty
        if sqlite3_step(statement) == SQLITE_ROW {
            let n = Double(matchCount)
            metrics = TeamPerGameMetrics(
                shots: Double(sqlite3_column_int(statement, 0)) / n,
                shotsOnTarget: Double(sqlite3_column_int(statement, 1)) / n,
                xg: sqlite3_column_double(statement, 2) / n,
                corners: Double(sqlite3_column_int(statement, 3)) / n,
                possession: sqlite3_column_double(statement, 4) / n,
                passes: Double(sqlite3_column_int(statement, 5)) / n,
                passesCompleted: Double(sqlite3_column_int(statement, 6)) / n
            )
        }

        sqlite3_finalize(statement)
        return metrics
    }

    private func computePerGameMetricsForFixtures(teamId: Int, fixtureIds: [Int], matchCount: Int, db: OpaquePointer) -> TeamPerGameMetrics {
        guard matchCount > 0, !fixtureIds.isEmpty else { return .empty }

        let placeholders = fixtureIds.map { _ in "?" }.joined(separator: ", ")
        let sql = """
        SELECT
            SUM(shots), SUM(shots_on_goal), SUM(xg), SUM(corners),
            SUM(possession), SUM(passes), SUM(passes_completed)
        FROM fixture_stats
        WHERE team_id = ? AND fixture_id IN (\(placeholders));
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return .empty
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        for (index, fixtureId) in fixtureIds.enumerated() {
            sqlite3_bind_int64(statement, Int32(index + 2), Int64(fixtureId))
        }

        var metrics = TeamPerGameMetrics.empty
        if sqlite3_step(statement) == SQLITE_ROW {
            let n = Double(matchCount)
            metrics = TeamPerGameMetrics(
                shots: Double(sqlite3_column_int(statement, 0)) / n,
                shotsOnTarget: Double(sqlite3_column_int(statement, 1)) / n,
                xg: sqlite3_column_double(statement, 2) / n,
                corners: Double(sqlite3_column_int(statement, 3)) / n,
                possession: sqlite3_column_double(statement, 4) / n,
                passes: Double(sqlite3_column_int(statement, 5)) / n,
                passesCompleted: Double(sqlite3_column_int(statement, 6)) / n
            )
        }

        sqlite3_finalize(statement)
        return metrics
    }

    private func computeMetricsComparison(teamId: Int, fixtures: [FixtureData], db: OpaquePointer) -> TeamMetricsComparison {
        let fixtureIds = fixtures.map { $0.id }
        guard !fixtureIds.isEmpty else { return .empty }

        let teamMetrics = computeMetricsForTeam(teamId: teamId, fixtureIds: fixtureIds, matchCount: fixtures.count, db: db)

        // Get opponent IDs for each fixture
        let opponentIds = fixtures.map { f in f.homeId == teamId ? f.awayId : f.homeId }
        let opponentMetrics = computeMetricsForOpponents(opponentIds: opponentIds, fixtureIds: fixtureIds, matchCount: fixtures.count, db: db)

        return TeamMetricsComparison(team: teamMetrics, opponents: opponentMetrics)
    }

    private func computeMetricsComparisonForFixtures(teamId: Int, fixtures: [FixtureData], db: OpaquePointer) -> TeamMetricsComparison {
        guard !fixtures.isEmpty else { return .empty }
        return computeMetricsComparison(teamId: teamId, fixtures: fixtures, db: db)
    }

    private func computeMetricsForTeam(teamId: Int, fixtureIds: [Int], matchCount: Int, db: OpaquePointer) -> TeamPerGameMetrics {
        guard matchCount > 0, !fixtureIds.isEmpty else { return .empty }

        let placeholders = fixtureIds.map { _ in "?" }.joined(separator: ", ")
        let sql = """
        SELECT
            SUM(shots), SUM(shots_on_goal), SUM(xg), SUM(corners),
            SUM(possession), SUM(passes), SUM(passes_completed)
        FROM fixture_stats
        WHERE team_id = ? AND fixture_id IN (\(placeholders));
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return .empty
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        for (index, fixtureId) in fixtureIds.enumerated() {
            sqlite3_bind_int64(statement, Int32(index + 2), Int64(fixtureId))
        }

        var metrics = TeamPerGameMetrics.empty
        if sqlite3_step(statement) == SQLITE_ROW {
            let n = Double(matchCount)
            metrics = TeamPerGameMetrics(
                shots: Double(sqlite3_column_int(statement, 0)) / n,
                shotsOnTarget: Double(sqlite3_column_int(statement, 1)) / n,
                xg: sqlite3_column_double(statement, 2) / n,
                corners: Double(sqlite3_column_int(statement, 3)) / n,
                possession: sqlite3_column_double(statement, 4) / n,
                passes: Double(sqlite3_column_int(statement, 5)) / n,
                passesCompleted: Double(sqlite3_column_int(statement, 6)) / n
            )
        }

        sqlite3_finalize(statement)
        return metrics
    }

    private func computeMetricsForOpponents(opponentIds: [Int], fixtureIds: [Int], matchCount: Int, db: OpaquePointer) -> TeamPerGameMetrics {
        guard matchCount > 0, !fixtureIds.isEmpty, opponentIds.count == fixtureIds.count else { return .empty }

        // Build query to sum stats for each opponent in their respective fixture
        let conditions = Array(repeating: "(team_id = ? AND fixture_id = ?)", count: fixtureIds.count)
        let whereClause = conditions.joined(separator: " OR ")

        let sql = """
        SELECT
            SUM(shots), SUM(shots_on_goal), SUM(xg), SUM(corners),
            SUM(possession), SUM(passes), SUM(passes_completed)
        FROM fixture_stats
        WHERE \(whereClause);
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return .empty
        }

        var bindIndex: Int32 = 1
        for i in 0..<fixtureIds.count {
            sqlite3_bind_int64(statement, bindIndex, Int64(opponentIds[i]))
            sqlite3_bind_int64(statement, bindIndex + 1, Int64(fixtureIds[i]))
            bindIndex += 2
        }

        var metrics = TeamPerGameMetrics.empty
        if sqlite3_step(statement) == SQLITE_ROW {
            let n = Double(matchCount)
            metrics = TeamPerGameMetrics(
                shots: Double(sqlite3_column_int(statement, 0)) / n,
                shotsOnTarget: Double(sqlite3_column_int(statement, 1)) / n,
                xg: sqlite3_column_double(statement, 2) / n,
                corners: Double(sqlite3_column_int(statement, 3)) / n,
                possession: sqlite3_column_double(statement, 4) / n,
                passes: Double(sqlite3_column_int(statement, 5)) / n,
                passesCompleted: Double(sqlite3_column_int(statement, 6)) / n
            )
        }

        sqlite3_finalize(statement)
        return metrics
    }

}

