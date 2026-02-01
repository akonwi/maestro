import Foundation

struct FixtureSummary: Identifiable, Equatable {
    let id: Int
    let leagueId: Int
    let homeName: String
    let awayName: String
    let status: String
    let kickoff: Date
    let homeGoals: Int
    let awayGoals: Int

    var isFinished: Bool { status == "FT" }
}

struct FixtureTab: Identifiable, Equatable {
    let id = UUID()
    let fixture: FixtureSummary
}

struct LeagueSection: Identifiable, Equatable {
    let id: Int
    let name: String
    let fixtures: [FixtureSummary]
}
