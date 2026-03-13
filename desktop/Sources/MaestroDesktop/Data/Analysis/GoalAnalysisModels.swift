import Foundation

struct GoalAnalysisPayload: Encodable {
    let fixture: FixtureInfo
    let homeTeam: TeamAnalysisData
    let awayTeam: TeamAnalysisData
    let markets: [MarketData]
    let bettingProfile: BettingProfile?
    let pendingBets: [PendingBet]?

    struct FixtureInfo: Encodable {
        let id: Int
        let leagueId: Int
        let season: Int
        let home: String
        let away: String
    }

    struct TeamAnalysisData: Encodable {
        let name: String
        let seasonGames: Int
        let seasonGoalsFor: Double
        let seasonGoalsAgainst: Double
        let seasonXGFor: Double
        let seasonXGAgainst: Double
        let venueGoalsFor: Double
        let venueGoalsAgainst: Double
        let venueXGFor: Double
        let venueXGAgainst: Double
        let venueGames: Int
        let shotsPerGame: Double
        let shotsOnGoalPerGame: Double
        let shotsInBoxShare: Double
        let possessionAvg: Double
        let recentForm: [RecentFixture]
    }

    struct RecentFixture: Encodable {
        let opponent: String
        let venue: String
        let goalsFor: Int
        let goalsAgainst: Int
        let xgFor: Double
        let xgAgainst: Double
    }

    struct MarketData: Encodable {
        let id: Int
        let name: String
        let lines: [LineData]
    }

    struct LineData: Encodable {
        let name: String
        let odds: Int
    }

    struct PendingBet: Encodable {
        let fixtureId: Int
        let marketId: Int
        let market: String
        let lineName: String?
        let odds: Int
        let stake: Double
        let potentialPayout: Double
    }

    struct BettingProfile: Encodable {
        let bankroll: Double
        let totalBets: Int
        let wins: Int
        let losses: Int
        let pushes: Int
        let winRate: Double
        let roi: Double
        let totalStaked: Double
        let netProfit: Double
    }
}

struct GoalAnalysisResponse: Codable {
    let analysis: Analysis
    let picks: [Pick]
    let pass: [String]
    let recommendation: String
    let summary: String

    struct Analysis: Codable {
        let expectedTotalGoals: Double
        let expectedHomeGoals: Double
        let expectedAwayGoals: Double
        let over2_5Probability: Double
        let bttsProbability: Double
        let totalConfidence: Double?
        let homeConfidence: Double?
        let awayConfidence: Double?
        let method: String
        let keyFactors: [String]

        enum CodingKeys: String, CodingKey {
            case expectedTotalGoals = "expected_total_goals"
            case expectedHomeGoals = "expected_home_goals"
            case expectedAwayGoals = "expected_away_goals"
            case over2_5Probability = "over_2_5_probability"
            case bttsProbability = "btts_probability"
            case totalConfidence = "total_confidence"
            case homeConfidence = "home_confidence"
            case awayConfidence = "away_confidence"
            case method
            case keyFactors = "key_factors"
        }
    }

    struct Pick: Codable, Identifiable {
        var id: String { "\(market)-\(line)" }
        let marketId: Int
        let market: String
        let line: String
        let odds: Int
        let impliedProbability: Double
        let estimatedProbability: Double
        let edgePoints: Double?
        let confidence: Double
        let expectedValuePct: Double
        let edge: String
        let risks: [String]
        let riskFlags: [String]?
        let noBetReason: String?
        let recommendedStake: Double?

        enum CodingKeys: String, CodingKey {
            case market, line, odds, edge, risks
            case marketId = "market_id"
            case impliedProbability = "implied_probability"
            case estimatedProbability = "estimated_probability"
            case edgePoints = "edge_points"
            case confidence
            case expectedValuePct = "expected_value_pct"
            case recommendedStake = "recommended_stake"
            case riskFlags = "risk_flags"
            case noBetReason = "no_bet_reason"
        }
    }
}
