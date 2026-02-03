import Foundation

// MARK: - Tab Identifier

enum TabIdentifier: Codable, Hashable, Equatable {
    case fixture(id: Int)
    case league(id: Int)
    case team(teamId: Int, leagueId: Int, season: Int)

    var uri: String {
        switch self {
        case .fixture(let id):
            return "fixture:\(id)"
        case .league(let id):
            return "league:\(id)"
        case .team(let teamId, let leagueId, let season):
            return "team:\(teamId):league:\(leagueId):season:\(season)"
        }
    }

    static func from(uri: String) -> TabIdentifier? {
        let parts = uri.split(separator: ":").map(String.init)

        if parts.count == 2, parts[0] == "fixture", let id = Int(parts[1]) {
            return .fixture(id: id)
        }

        if parts.count == 2, parts[0] == "league", let id = Int(parts[1]) {
            return .league(id: id)
        }

        if parts.count == 6,
           parts[0] == "team", let teamId = Int(parts[1]),
           parts[2] == "league", let leagueId = Int(parts[3]),
           parts[4] == "season", let season = Int(parts[5]) {
            return .team(teamId: teamId, leagueId: leagueId, season: season)
        }

        return nil
    }
}

// MARK: - Persisted Tab State

struct PersistedFixtureTab: Codable {
    let fixtureId: Int
    let activeTab: String?
    let formScope: String
}

struct PersistedLeagueTab: Codable {
    let leagueId: Int
}

struct PersistedTeamTab: Codable {
    let teamId: Int
    let leagueId: Int
    let season: Int
    let activeTab: String
    let statsScope: String
}

// MARK: - Session State

struct SessionState: Codable {
    let fixtureTabs: [PersistedFixtureTab]
    let leagueTabs: [PersistedLeagueTab]
    let teamTabs: [PersistedTeamTab]
    let activeTabUri: String?

    static let empty = SessionState(fixtureTabs: [], leagueTabs: [], teamTabs: [], activeTabUri: nil)
}

// MARK: - Session Persistence

@MainActor
final class SessionPersistence {
    static let shared = SessionPersistence()

    private let key = "maestro.sessionState"

    func save(_ state: SessionState) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    func load() -> SessionState? {
        guard let data = UserDefaults.standard.data(forKey: key),
              let state = try? JSONDecoder().decode(SessionState.self, from: data) else {
            return nil
        }
        return state
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
