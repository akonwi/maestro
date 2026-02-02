import Foundation

struct LeagueTab: Identifiable, Equatable {
    let id = UUID()
    let league: FollowedLeague
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
