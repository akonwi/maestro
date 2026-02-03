import Foundation

struct LeagueTab: Identifiable, Equatable {
    let id = UUID()
    let league: FollowedLeague

    // Display state
    var sortColumn: LeagueSortColumn = .position
    var sortAscending: Bool = true

    enum LeagueSortColumn: String, Equatable {
        case position, teamName, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points
    }

    static func == (lhs: LeagueTab, rhs: LeagueTab) -> Bool {
        lhs.league.id == rhs.league.id
    }
}

struct StandingRow: Identifiable {
    let position: Int
    let teamId: Int
    let teamName: String
    let played: Int
    let won: Int
    let drawn: Int
    let lost: Int
    let goalsFor: Int
    let goalsAgainst: Int
    let goalDifference: Int
    let points: Int

    var id: Int { teamId }
}

struct TeamTab: Identifiable, Equatable {
    let id = UUID()
    let teamId: Int
    let teamName: String
    let leagueId: Int
    let leagueName: String
    let season: Int

    // Display state
    var activeTab: TeamTabView = .stats
    var statsScope: TeamStatsScope = .form

    enum TeamTabView: String, CaseIterable, Identifiable {
        case stats = "Stats"
        case fixtures = "Fixtures"
        var id: String { rawValue }
    }

    enum TeamStatsScope: String, CaseIterable, Identifiable {
        case form = "Form"
        case season = "Season"
        var id: String { rawValue }
    }

    static func == (lhs: TeamTab, rhs: TeamTab) -> Bool {
        lhs.teamId == rhs.teamId && lhs.leagueId == rhs.leagueId && lhs.season == rhs.season
    }
}

struct TeamDetails {
    let teamId: Int
    let teamName: String
    let leagueId: Int
    let leagueName: String
    let season: Int

    let seasonRecord: TeamRecordSplit
    let formRecord: TeamRecordSplit

    let form: [TeamFormResult]
    let allFixtures: [TeamFixtureResult]
    let nextFixture: FixtureSummary?

    let seasonMetrics: TeamMetricsComparison
    let formMetrics: TeamMetricsComparison
}

struct TeamRecordSplit {
    let overall: TeamRecord
    let home: TeamRecord
    let away: TeamRecord

    static let empty = TeamRecordSplit(overall: .empty, home: .empty, away: .empty)
}

struct TeamRecord {
    let played: Int
    let won: Int
    let drawn: Int
    let lost: Int
    let goalsFor: Int
    let goalsAgainst: Int
    let cleanSheets: Int

    static let empty = TeamRecord(played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0)
}

struct TeamFormResult: Identifiable {
    let id: Int
    let result: MatchResult
    let opponent: String
    let goalsFor: Int
    let goalsAgainst: Int
    let isHome: Bool
    let date: Date

    enum MatchResult: String {
        case win = "W"
        case draw = "D"
        case loss = "L"
    }
}

struct TeamFixtureResult: Identifiable {
    let id: Int
    let opponent: String
    let goalsFor: Int
    let goalsAgainst: Int
    let isHome: Bool
    let date: Date
    let isFinished: Bool
}

struct TeamMetricsComparison {
    let team: TeamPerGameMetrics
    let opponents: TeamPerGameMetrics

    static let empty = TeamMetricsComparison(team: .empty, opponents: .empty)
}

struct TeamPerGameMetrics {
    let shots: Double
    let shotsOnTarget: Double
    let xg: Double
    let corners: Double
    let possession: Double
    let passes: Double
    let passesCompleted: Double

    var passAccuracy: Double {
        passes > 0 ? passesCompleted / passes : 0
    }

    static let empty = TeamPerGameMetrics(shots: 0, shotsOnTarget: 0, xg: 0, corners: 0, possession: 0, passes: 0, passesCompleted: 0)
}

