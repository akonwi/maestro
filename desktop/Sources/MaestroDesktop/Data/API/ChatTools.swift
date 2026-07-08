import Foundation

@MainActor
struct ChatTools {
    static func definitions() -> [[String: Any]] {
        [
            makeTool(
                name: "get_fixtures_for_date",
                description: "Get all fixtures/matches for a given date, grouped by league.",
                parameters: [
                    "properties": [
                        "date": [
                            "type": "string",
                            "description": "Date in YYYY-MM-DD format",
                        ] as [String: Any],
                    ] as [String: Any],
                    "required": ["date"],
                ]
            ),
            makeTool(
                name: "get_fixture_stats",
                description: "Get match statistics (shots, possession, corners, xG, etc.) for a finished fixture.",
                parameters: [
                    "properties": [
                        "fixture_id": ["type": "integer", "description": "The fixture ID"],
                        "home_id": ["type": "integer", "description": "Home team ID"],
                        "away_id": ["type": "integer", "description": "Away team ID"],
                    ] as [String: Any],
                    "required": ["fixture_id", "home_id", "away_id"],
                ]
            ),
            makeTool(
                name: "get_followed_leagues",
                description: "Get all leagues the user is following, with their IDs, names, and current seasons.",
                parameters: [:]
            ),
            makeTool(
                name: "get_league_standings",
                description: "Get the league table/standings for a specific league and season.",
                parameters: [
                    "properties": [
                        "league_id": ["type": "integer", "description": "The league ID"],
                        "season": ["type": "integer", "description": "The season year (e.g. 2024)"],
                    ] as [String: Any],
                    "required": ["league_id", "season"],
                ]
            ),
        ]
    }

    static func execute(name: String, arguments: [String: Any]) -> String {
        switch name {
        case "get_fixtures_for_date":
            guard let dateStr = arguments["date"] as? String else {
                return errorJSON("Missing date parameter")
            }
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.timeZone = .current
            guard let date = formatter.date(from: dateStr) else {
                return errorJSON("Invalid date format. Use YYYY-MM-DD.")
            }
            let repo = FixtureRepository()
            return serializeLeagueSections(repo.fixturesGroupedByLeague(for: date))
        case "get_fixture_stats":
            guard let fixtureId = intArg(arguments, "fixture_id"),
                  let homeId = intArg(arguments, "home_id"),
                  let awayId = intArg(arguments, "away_id") else {
                return errorJSON("Missing fixture_id, home_id, or away_id")
            }
            let repo = FixtureRepository()
            guard let stats = repo.stats(for: fixtureId, homeId: homeId, awayId: awayId) else {
                return errorJSON("No stats found for fixture \(fixtureId)")
            }
            return serializeFixtureStats(stats)
        case "get_followed_leagues":
            let repo = LeagueRepository()
            return serializeLeagues(repo.followedLeagues())
        case "get_league_standings":
            guard let leagueId = intArg(arguments, "league_id"),
                  let season = intArg(arguments, "season") else {
                return errorJSON("Missing league_id or season")
            }
            let repo = LeagueRepository()
            return serializeStandings(repo.standings(leagueId: leagueId, season: season))
        default:
            return errorJSON("Unknown tool: \(name)")
        }
    }

    // MARK: - Helpers

    private static func makeTool(name: String, description: String, parameters: [String: Any]) -> [String: Any] {
        var params = parameters
        params["type"] = "object"
        if params["properties"] == nil {
            params["properties"] = [:] as [String: Any]
        }

        return [
            "type": "function",
            "function": [
                "name": name,
                "description": description,
                "parameters": params,
            ] as [String: Any],
        ]
    }

    private static func intArg(_ args: [String: Any], _ key: String) -> Int? {
        if let v = args[key] as? Int { return v }
        if let v = args[key] as? Double { return Int(v) }
        if let v = args[key] as? String, let i = Int(v) { return i }
        return nil
    }

    private static func toJSON(_ value: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
              let str = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return str
    }

    private static func errorJSON(_ message: String) -> String {
        toJSON(["error": message])
    }

    // MARK: - Serializers

    private static func serializeLeagueSections(_ sections: [LeagueSection]) -> String {
        let items = sections.map { section in
            [
                "leagueId": section.id,
                "leagueName": section.name,
                "fixtures": section.fixtures.map { serializeFixtureDict($0) },
            ] as [String: Any]
        }
        return toJSON(items)
    }

    private static func serializeFixtureDict(_ f: FixtureSummary) -> [String: Any] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return [
            "id": f.id,
            "homeTeam": f.homeName,
            "awayTeam": f.awayName,
            "homeId": f.homeId,
            "awayId": f.awayId,
            "status": f.status,
            "kickoff": formatter.string(from: f.kickoff),
            "homeGoals": f.homeGoals,
            "awayGoals": f.awayGoals,
            "isFinished": f.isFinished,
        ]
    }

    private static func serializeFixtureStats(_ stats: FixtureStats) -> String {
        toJSON([
            "home": serializeTeamStats(stats.home),
            "away": serializeTeamStats(stats.away),
        ])
    }

    private static func serializeTeamStats(_ ts: TeamStats) -> [String: Any] {
        [
            "teamId": ts.teamId,
            "shots": ts.shots,
            "shotsOnGoal": ts.shotsOnGoal,
            "possession": ts.possession,
            "passes": ts.passes,
            "passesCompleted": ts.passesCompleted,
            "fouls": ts.fouls,
            "corners": ts.corners,
            "offsides": ts.offsides,
            "yellowCards": ts.yellowCards,
            "redCards": ts.redCards,
            "xg": ts.xg,
        ]
    }

    private static func serializeLeagues(_ leagues: [FollowedLeague]) -> String {
        let items = leagues.map { league in
            [
                "id": league.id,
                "name": league.name,
                "currentSeason": league.currentSeason,
            ] as [String: Any]
        }
        return toJSON(items)
    }

    private static func serializeStandings(_ rows: [StandingRow]) -> String {
        let items = rows.map { row in
            [
                "position": row.position,
                "teamId": row.teamId,
                "teamName": row.teamName,
                "played": row.played,
                "won": row.won,
                "drawn": row.drawn,
                "lost": row.lost,
                "goalsFor": row.goalsFor,
                "goalsAgainst": row.goalsAgainst,
                "goalDifference": row.goalDifference,
                "points": row.points,
            ] as [String: Any]
        }
        return toJSON(items)
    }
}
