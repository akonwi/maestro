import Foundation

struct FixtureSummary: Identifiable, Equatable {
    let id: Int
    let leagueId: Int
    let season: Int
    let homeId: Int
    let awayId: Int
    let homeName: String
    let awayName: String
    let status: String
    let kickoff: Date
    let homeGoals: Int
    let awayGoals: Int

    var isFinished: Bool { status == "FT" }

    var homeLogoURL: URL? {
        URL(string: "https://media.api-sports.io/football/teams/\(homeId).png")
    }

    var awayLogoURL: URL? {
        URL(string: "https://media.api-sports.io/football/teams/\(awayId).png")
    }
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
