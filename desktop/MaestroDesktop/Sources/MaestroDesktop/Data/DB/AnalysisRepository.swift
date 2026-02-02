import Foundation
import SQLite3

@MainActor
final class AnalysisRepository {
    static let shared = AnalysisRepository()

    private init() {}

    func buildAnalysisPayload(for fixture: FixtureSummary, odds: CornerOddsData?) -> CornerAnalysisPayload? {
        guard let homeData = getTeamAnalysisData(
            teamId: fixture.homeId,
            teamName: fixture.homeName,
            leagueId: fixture.leagueId,
            season: fixture.season,
            isHome: true,
            excludeFixtureId: fixture.id
        ) else { return nil }

        guard let awayData = getTeamAnalysisData(
            teamId: fixture.awayId,
            teamName: fixture.awayName,
            leagueId: fixture.leagueId,
            season: fixture.season,
            isHome: false,
            excludeFixtureId: fixture.id
        ) else { return nil }

        let markets = (odds?.markets ?? []).map { market in
            CornerAnalysisPayload.MarketData(
                id: market.id,
                name: market.name,
                lines: market.lines.map { line in
                    CornerAnalysisPayload.LineData(name: line.name, odds: line.americanOdd)
                }
            )
        }

        return CornerAnalysisPayload(
            fixture: CornerAnalysisPayload.FixtureInfo(
                home: fixture.homeName,
                away: fixture.awayName
            ),
            homeTeam: homeData,
            awayTeam: awayData,
            markets: markets
        )
    }

    private func getTeamAnalysisData(
        teamId: Int,
        teamName: String,
        leagueId: Int,
        season: Int,
        isHome: Bool,
        excludeFixtureId: Int
    ) -> CornerAnalysisPayload.TeamAnalysisData? {
        guard let db = Database.shared.handle else { return nil }

        // Season stats
        let seasonStats = getSeasonStats(db: db, teamId: teamId, leagueId: leagueId, season: season, excludeFixtureId: excludeFixtureId)

        // Venue stats (home or away only)
        let venueStats = getVenueStats(db: db, teamId: teamId, leagueId: leagueId, season: season, isHome: isHome, excludeFixtureId: excludeFixtureId)

        // Recent form with actual corner numbers
        let recentForm = getRecentForm(db: db, teamId: teamId, leagueId: leagueId, season: season, limit: 5, excludeFixtureId: excludeFixtureId)

        return CornerAnalysisPayload.TeamAnalysisData(
            name: teamName,
            seasonGames: seasonStats.games,
            seasonCornersFor: seasonStats.cornersFor,
            seasonCornersAgainst: seasonStats.cornersAgainst,
            venueCornersFor: venueStats.cornersFor,
            venueCornersAgainst: venueStats.cornersAgainst,
            venueGames: venueStats.games,
            shotsPerGame: seasonStats.shotsPerGame,
            possessionAvg: seasonStats.possessionAvg,
            recentForm: recentForm
        )
    }

    private struct SeasonStatsResult {
        let games: Int
        let cornersFor: Double
        let cornersAgainst: Double
        let shotsPerGame: Double
        let possessionAvg: Double
    }

    private func getSeasonStats(db: OpaquePointer, teamId: Int, leagueId: Int, season: Int, excludeFixtureId: Int) -> SeasonStatsResult {
        let sql = """
        SELECT
            COUNT(*) as games,
            AVG(fs.corners) as corners_for,
            AVG(opp.corners) as corners_against,
            AVG(fs.shots) as shots,
            AVG(fs.possession) as possession
        FROM fixture_stats fs
        JOIN fixtures f ON f.id = fs.fixture_id
        JOIN fixture_stats opp ON opp.fixture_id = f.id AND opp.team_id != fs.team_id
        WHERE fs.team_id = ?
          AND fs.league_id = ?
          AND fs.season = ?
          AND f.finished = 1
          AND f.id != ?
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            return SeasonStatsResult(games: 0, cornersFor: 0, cornersAgainst: 0, shotsPerGame: 0, possessionAvg: 0)
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(leagueId))
        sqlite3_bind_int64(statement, 3, Int64(season))
        sqlite3_bind_int64(statement, 4, Int64(excludeFixtureId))

        var result = SeasonStatsResult(games: 0, cornersFor: 0, cornersAgainst: 0, shotsPerGame: 0, possessionAvg: 0)

        if sqlite3_step(statement) == SQLITE_ROW {
            result = SeasonStatsResult(
                games: Int(sqlite3_column_int(statement, 0)),
                cornersFor: sqlite3_column_double(statement, 1),
                cornersAgainst: sqlite3_column_double(statement, 2),
                shotsPerGame: sqlite3_column_double(statement, 3),
                possessionAvg: sqlite3_column_double(statement, 4)
            )
        }

        sqlite3_finalize(statement)
        return result
    }

    private struct VenueStatsResult {
        let games: Int
        let cornersFor: Double
        let cornersAgainst: Double
    }

    private func getVenueStats(db: OpaquePointer, teamId: Int, leagueId: Int, season: Int, isHome: Bool, excludeFixtureId: Int) -> VenueStatsResult {
        let venueCondition = isHome ? "f.home_id = ?" : "f.away_id = ?"

        let sql = """
        SELECT
            COUNT(*) as games,
            AVG(fs.corners) as corners_for,
            AVG(opp.corners) as corners_against
        FROM fixture_stats fs
        JOIN fixtures f ON f.id = fs.fixture_id
        JOIN fixture_stats opp ON opp.fixture_id = f.id AND opp.team_id != fs.team_id
        WHERE fs.team_id = ?
          AND fs.league_id = ?
          AND fs.season = ?
          AND \(venueCondition)
          AND f.finished = 1
          AND f.id != ?
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            return VenueStatsResult(games: 0, cornersFor: 0, cornersAgainst: 0)
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(leagueId))
        sqlite3_bind_int64(statement, 3, Int64(season))
        sqlite3_bind_int64(statement, 4, Int64(teamId))
        sqlite3_bind_int64(statement, 5, Int64(excludeFixtureId))

        var result = VenueStatsResult(games: 0, cornersFor: 0, cornersAgainst: 0)

        if sqlite3_step(statement) == SQLITE_ROW {
            result = VenueStatsResult(
                games: Int(sqlite3_column_int(statement, 0)),
                cornersFor: sqlite3_column_double(statement, 1),
                cornersAgainst: sqlite3_column_double(statement, 2)
            )
        }

        sqlite3_finalize(statement)
        return result
    }

    private func getRecentForm(db: OpaquePointer, teamId: Int, leagueId: Int, season: Int, limit: Int, excludeFixtureId: Int) -> [CornerAnalysisPayload.RecentFixture] {
        let sql = """
        SELECT
            CASE WHEN f.home_id = ? THEN t_away.name ELSE t_home.name END as opponent,
            CASE WHEN f.home_id = ? THEN 'H' ELSE 'A' END as venue,
            fs.corners as corners_won,
            opp.corners as corners_conceded
        FROM fixture_stats fs
        JOIN fixtures f ON f.id = fs.fixture_id
        JOIN fixture_stats opp ON opp.fixture_id = f.id AND opp.team_id != fs.team_id
        JOIN teams t_home ON t_home.id = f.home_id
        JOIN teams t_away ON t_away.id = f.away_id
        WHERE fs.team_id = ?
          AND fs.league_id = ?
          AND fs.season = ?
          AND f.finished = 1
          AND f.id != ?
        ORDER BY f.timestamp DESC
        LIMIT ?
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            return []
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(teamId))
        sqlite3_bind_int64(statement, 3, Int64(teamId))
        sqlite3_bind_int64(statement, 4, Int64(leagueId))
        sqlite3_bind_int64(statement, 5, Int64(season))
        sqlite3_bind_int64(statement, 6, Int64(excludeFixtureId))
        sqlite3_bind_int64(statement, 7, Int64(limit))

        var results: [CornerAnalysisPayload.RecentFixture] = []

        while sqlite3_step(statement) == SQLITE_ROW {
            let opponent = sqlite3_column_text(statement, 0).map { String(cString: $0) } ?? "Unknown"
            let venue = sqlite3_column_text(statement, 1).map { String(cString: $0) } ?? "H"
            let cornersWon = Int(sqlite3_column_int(statement, 2))
            let cornersConceded = Int(sqlite3_column_int(statement, 3))

            results.append(CornerAnalysisPayload.RecentFixture(
                opponent: opponent,
                venue: venue,
                cornersWon: cornersWon,
                cornersConceded: cornersConceded
            ))
        }

        sqlite3_finalize(statement)
        return results
    }
}
