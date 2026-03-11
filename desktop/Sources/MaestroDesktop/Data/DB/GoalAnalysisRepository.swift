import Foundation
import SQLite3

@MainActor
final class GoalAnalysisRepository {
    static let shared = GoalAnalysisRepository()

    private init() {}

    func buildAnalysisPayload(for fixture: FixtureSummary, markets: [APIOddsMarket], bankroll: Double) -> GoalAnalysisPayload? {
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

        let payloadMarkets: [GoalAnalysisPayload.MarketData] = markets.compactMap { market -> GoalAnalysisPayload.MarketData? in
            let lines: [GoalAnalysisPayload.LineData] = market.values.compactMap { line -> GoalAnalysisPayload.LineData? in
                guard let americanOdd = line.americanOddValue else { return nil }
                return GoalAnalysisPayload.LineData(name: line.lineName, odds: americanOdd)
            }
            guard !lines.isEmpty else { return nil }
            return GoalAnalysisPayload.MarketData(
                id: market.id,
                name: market.displayName,
                lines: lines
            )
        }

        let betStats = BetRepository.shared.stats()
        let pending = BetRepository.shared.pendingBets()
        let pendingStakes = pending.reduce(0) { $0 + $1.stake }
        let effectiveBankroll = bankroll + betStats.netProfit - pendingStakes
        let profile: GoalAnalysisPayload.BettingProfile? = bankroll > 0
            ? GoalAnalysisPayload.BettingProfile(
                bankroll: effectiveBankroll,
                totalBets: betStats.totalBets,
                wins: betStats.wins,
                losses: betStats.losses,
                pushes: betStats.pushes,
                winRate: betStats.winRate,
                roi: betStats.roi,
                totalStaked: betStats.totalStaked,
                netProfit: betStats.netProfit
            )
            : nil

        let pendingBets: [GoalAnalysisPayload.PendingBet]? = pending.isEmpty ? nil : pending.map { bet in
            GoalAnalysisPayload.PendingBet(
                market: bet.displayDescription,
                odds: bet.odds,
                stake: bet.stake,
                potentialPayout: bet.potentialPayout
            )
        }

        return GoalAnalysisPayload(
            fixture: GoalAnalysisPayload.FixtureInfo(
                leagueId: fixture.leagueId,
                season: fixture.season,
                home: fixture.homeName,
                away: fixture.awayName
            ),
            homeTeam: homeData,
            awayTeam: awayData,
            markets: payloadMarkets,
            bettingProfile: profile,
            pendingBets: pendingBets
        )
    }

    private func getTeamAnalysisData(
        teamId: Int,
        teamName: String,
        leagueId: Int,
        season: Int,
        isHome: Bool,
        excludeFixtureId: Int
    ) -> GoalAnalysisPayload.TeamAnalysisData? {
        guard let db = Database.shared.handle else { return nil }

        let seasonStats = getSeasonStats(db: db, teamId: teamId, leagueId: leagueId, season: season, excludeFixtureId: excludeFixtureId)
        let venueStats = getVenueStats(db: db, teamId: teamId, leagueId: leagueId, season: season, isHome: isHome, excludeFixtureId: excludeFixtureId)
        let recentForm = getRecentForm(db: db, teamId: teamId, leagueId: leagueId, season: season, limit: 5, excludeFixtureId: excludeFixtureId)

        return GoalAnalysisPayload.TeamAnalysisData(
            name: teamName,
            seasonGames: seasonStats.games,
            seasonGoalsFor: seasonStats.goalsFor,
            seasonGoalsAgainst: seasonStats.goalsAgainst,
            seasonXGFor: seasonStats.xgFor,
            seasonXGAgainst: seasonStats.xgAgainst,
            venueGoalsFor: venueStats.goalsFor,
            venueGoalsAgainst: venueStats.goalsAgainst,
            venueXGFor: venueStats.xgFor,
            venueXGAgainst: venueStats.xgAgainst,
            venueGames: venueStats.games,
            shotsPerGame: seasonStats.shotsPerGame,
            shotsOnGoalPerGame: seasonStats.shotsOnGoalPerGame,
            shotsInBoxShare: seasonStats.shotsInBoxShare,
            possessionAvg: seasonStats.possessionAvg,
            recentForm: recentForm
        )
    }

    private struct SeasonStatsResult {
        let games: Int
        let goalsFor: Double
        let goalsAgainst: Double
        let xgFor: Double
        let xgAgainst: Double
        let shotsPerGame: Double
        let shotsOnGoalPerGame: Double
        let shotsInBoxShare: Double
        let possessionAvg: Double
    }

    private func getSeasonStats(db: OpaquePointer, teamId: Int, leagueId: Int, season: Int, excludeFixtureId: Int) -> SeasonStatsResult {
        let sql = """
        SELECT
            COUNT(*) as games,
            AVG(CASE WHEN f.home_id = fs.team_id THEN f.home_goals ELSE f.away_goals END) as goals_for,
            AVG(CASE WHEN f.home_id = fs.team_id THEN f.away_goals ELSE f.home_goals END) as goals_against,
            AVG(fs.xg) as xg_for,
            AVG(opp.xg) as xg_against,
            AVG(fs.shots) as shots,
            AVG(fs.shots_on_goal) as shots_on_goal,
            (SUM(fs.shots_in_box) * 1.0 / NULLIF(SUM(fs.shots), 0)) as shots_in_box_share,
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
            return .init(games: 0, goalsFor: 0, goalsAgainst: 0, xgFor: 0, xgAgainst: 0, shotsPerGame: 0, shotsOnGoalPerGame: 0, shotsInBoxShare: 0, possessionAvg: 0)
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(leagueId))
        sqlite3_bind_int64(statement, 3, Int64(season))
        sqlite3_bind_int64(statement, 4, Int64(excludeFixtureId))

        var result = SeasonStatsResult(games: 0, goalsFor: 0, goalsAgainst: 0, xgFor: 0, xgAgainst: 0, shotsPerGame: 0, shotsOnGoalPerGame: 0, shotsInBoxShare: 0, possessionAvg: 0)
        if sqlite3_step(statement) == SQLITE_ROW {
            result = SeasonStatsResult(
                games: Int(sqlite3_column_int(statement, 0)),
                goalsFor: sqlite3_column_double(statement, 1),
                goalsAgainst: sqlite3_column_double(statement, 2),
                xgFor: sqlite3_column_double(statement, 3),
                xgAgainst: sqlite3_column_double(statement, 4),
                shotsPerGame: sqlite3_column_double(statement, 5),
                shotsOnGoalPerGame: sqlite3_column_double(statement, 6),
                shotsInBoxShare: sqlite3_column_double(statement, 7),
                possessionAvg: sqlite3_column_double(statement, 8)
            )
        }

        sqlite3_finalize(statement)
        return result
    }

    private struct VenueStatsResult {
        let games: Int
        let goalsFor: Double
        let goalsAgainst: Double
        let xgFor: Double
        let xgAgainst: Double
    }

    private func getVenueStats(db: OpaquePointer, teamId: Int, leagueId: Int, season: Int, isHome: Bool, excludeFixtureId: Int) -> VenueStatsResult {
        let venueCondition = isHome ? "f.home_id = ?" : "f.away_id = ?"

        let sql = """
        SELECT
            COUNT(*) as games,
            AVG(CASE WHEN f.home_id = fs.team_id THEN f.home_goals ELSE f.away_goals END) as goals_for,
            AVG(CASE WHEN f.home_id = fs.team_id THEN f.away_goals ELSE f.home_goals END) as goals_against,
            AVG(fs.xg) as xg_for,
            AVG(opp.xg) as xg_against
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
            return .init(games: 0, goalsFor: 0, goalsAgainst: 0, xgFor: 0, xgAgainst: 0)
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))
        sqlite3_bind_int64(statement, 2, Int64(leagueId))
        sqlite3_bind_int64(statement, 3, Int64(season))
        sqlite3_bind_int64(statement, 4, Int64(teamId))
        sqlite3_bind_int64(statement, 5, Int64(excludeFixtureId))

        var result = VenueStatsResult(games: 0, goalsFor: 0, goalsAgainst: 0, xgFor: 0, xgAgainst: 0)
        if sqlite3_step(statement) == SQLITE_ROW {
            result = VenueStatsResult(
                games: Int(sqlite3_column_int(statement, 0)),
                goalsFor: sqlite3_column_double(statement, 1),
                goalsAgainst: sqlite3_column_double(statement, 2),
                xgFor: sqlite3_column_double(statement, 3),
                xgAgainst: sqlite3_column_double(statement, 4)
            )
        }

        sqlite3_finalize(statement)
        return result
    }

    private func getRecentForm(db: OpaquePointer, teamId: Int, leagueId: Int, season: Int, limit: Int, excludeFixtureId: Int) -> [GoalAnalysisPayload.RecentFixture] {
        let sql = """
        SELECT
            CASE WHEN f.home_id = ? THEN t_away.name ELSE t_home.name END as opponent,
            CASE WHEN f.home_id = ? THEN 'H' ELSE 'A' END as venue,
            CASE WHEN f.home_id = fs.team_id THEN f.home_goals ELSE f.away_goals END as goals_for,
            CASE WHEN f.home_id = fs.team_id THEN f.away_goals ELSE f.home_goals END as goals_against,
            fs.xg as xg_for,
            opp.xg as xg_against
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

        var results: [GoalAnalysisPayload.RecentFixture] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            let opponent = sqlite3_column_text(statement, 0).map { String(cString: $0) } ?? "Unknown"
            let venue = sqlite3_column_text(statement, 1).map { String(cString: $0) } ?? "H"
            let goalsFor = Int(sqlite3_column_int(statement, 2))
            let goalsAgainst = Int(sqlite3_column_int(statement, 3))
            let xgFor = sqlite3_column_double(statement, 4)
            let xgAgainst = sqlite3_column_double(statement, 5)

            results.append(
                GoalAnalysisPayload.RecentFixture(
                    opponent: opponent,
                    venue: venue,
                    goalsFor: goalsFor,
                    goalsAgainst: goalsAgainst,
                    xgFor: xgFor,
                    xgAgainst: xgAgainst
                )
            )
        }

        sqlite3_finalize(statement)
        return results
    }
}
