import Foundation

// MARK: - Corner Odds

struct CornerOddsData: Equatable, Codable {
    let markets: [CornerMarket]

    static let empty = CornerOddsData(markets: [])
}

struct CornerMarket: Identifiable, Equatable, Codable {
    let id: Int
    let name: String
    let lines: [CornerLine]
}

struct CornerLine: Identifiable, Equatable, Codable {
    let id: String
    let name: String
    let americanOdd: Int
    let value: Double?

    var formattedOdd: String {
        if americanOdd > 0 {
            return "+\(americanOdd)"
        }
        return "\(americanOdd)"
    }
}

// MARK: - Form Scope

enum FormScope: String, CaseIterable, Identifiable {
    case last5 = "Last 5"
    case season = "Season"

    var id: String { rawValue }
}

struct PreMatchData: Equatable {
    let home: TeamPreMatchStats
    let away: TeamPreMatchStats
}

struct TeamPreMatchStats: Equatable {
    let teamId: Int
    let teamName: String
    let form: [FormResult]
    let seasonStats: SeasonStats
}

struct FormResult: Identifiable, Equatable {
    let id: Int  // fixture id
    let opponent: String
    let isHome: Bool
    let goalsFor: Int
    let goalsAgainst: Int
    let date: Date

    var result: MatchResult {
        if goalsFor > goalsAgainst { return .win }
        if goalsFor < goalsAgainst { return .loss }
        return .draw
    }

    enum MatchResult: String {
        case win = "W"
        case draw = "D"
        case loss = "L"
    }
}

// MARK: - Matchup Metrics

struct MatchupData: Equatable {
    let home: TeamMatchupMetrics
    let away: TeamMatchupMetrics
}

struct TeamMatchupMetrics: Equatable {
    let teamId: Int
    let teamName: String
    let forStats: MatchupStats      // What this team produces
    let againstStats: MatchupStats  // What opponents produce against this team
}

struct MatchupStats: Equatable {
    let gamesPlayed: Int
    let shotsPerGame: Double
    let shotsOnTargetPerGame: Double
    let xgPerGame: Double
    let cornersPerGame: Double
    let possessionAvg: Double

    static let empty = MatchupStats(
        gamesPlayed: 0,
        shotsPerGame: 0,
        shotsOnTargetPerGame: 0,
        xgPerGame: 0,
        cornersPerGame: 0,
        possessionAvg: 0
    )
}

// MARK: - Season Stats

struct SeasonStats: Equatable {
    let played: Int
    let wins: Int
    let draws: Int
    let losses: Int
    let goalsFor: Int
    let goalsAgainst: Int
    let xgFor: Double
    let xgAgainst: Double
    let cleanSheets: Int
    let shotsPerGame: Double
    let shotsOnTargetPerGame: Double
    let cornersPerGame: Double
    let possessionAvg: Double

    var winRate: Double {
        guard played > 0 else { return 0 }
        return Double(wins) / Double(played)
    }

    var goalDifference: Int {
        goalsFor - goalsAgainst
    }

    var xgDifference: Double {
        xgFor - xgAgainst
    }

    static let empty = SeasonStats(
        played: 0, wins: 0, draws: 0, losses: 0,
        goalsFor: 0, goalsAgainst: 0,
        xgFor: 0, xgAgainst: 0,
        cleanSheets: 0,
        shotsPerGame: 0, shotsOnTargetPerGame: 0,
        cornersPerGame: 0, possessionAvg: 0
    )
}
