import Foundation

struct APIFootballClient {
    let apiKey: String
    private let baseURL = "https://v3.football.api-sports.io"

    private func request<T: Decodable>(path: String) async throws -> T {
        guard !apiKey.isEmpty else {
            throw APIError.missingApiKey
        }

        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "x-apisports-key")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(httpResponse.statusCode)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    func searchLeagues(query: String) async throws -> [LeagueSearchResult] {
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            throw APIError.invalidURL
        }
        let response: LeaguesResponse = try await request(path: "/leagues?search=\(encoded)")
        return response.response
    }

    func getLeague(id: Int) async throws -> LeagueSearchResult? {
        let response: LeaguesResponse = try await request(path: "/leagues?id=\(id)")
        return response.response.first
    }

    func getSeasonFixtures(leagueId: Int, season: Int) async throws -> [APIFixture] {
        let response: FixturesResponse = try await request(path: "/fixtures?league=\(leagueId)&season=\(season)")
        return response.response
    }

    func getFixture(id: Int) async throws -> APIFixture? {
        let response: FixturesResponse = try await request(path: "/fixtures?id=\(id)")
        return response.response.first
    }

    enum APIError: LocalizedError {
        case missingApiKey
        case invalidURL
        case invalidResponse
        case httpError(Int)

        var errorDescription: String? {
            switch self {
            case .missingApiKey:
                return "API key not configured. Add it in Settings."
            case .invalidURL:
                return "Invalid request URL."
            case .invalidResponse:
                return "Invalid response from server."
            case .httpError(let code):
                return "HTTP error: \(code)"
            }
        }
    }
}

struct LeaguesResponse: Decodable {
    let response: [LeagueSearchResult]
}

struct LeagueSearchResult: Decodable, Identifiable {
    let league: LeagueInfo
    let country: CountryInfo
    let seasons: [SeasonInfo]?

    var id: Int { league.id }
    var currentSeason: Int? {
        seasons?.first(where: { $0.current })?.year
    }

    struct LeagueInfo: Decodable {
        let id: Int
        let name: String
        let type: String
        let logo: String?
    }

    struct CountryInfo: Decodable {
        let name: String
        let code: String?
        let flag: String?
    }

    struct SeasonInfo: Decodable {
        let year: Int
        let current: Bool
    }
}

// MARK: - Fixtures

struct FixturesResponse: Decodable {
    let response: [APIFixture]
}

struct APIFixture: Decodable, Identifiable {
    let fixture: FixtureInfo
    let league: LeagueRef
    let teams: TeamsRef
    let goals: GoalsRef
    let statistics: [TeamStatistics]?

    var id: Int { fixture.id }

    struct FixtureInfo: Decodable {
        let id: Int
        let timestamp: Int
        let status: StatusRef

        struct StatusRef: Decodable {
            let short: String
        }
    }

    struct LeagueRef: Decodable {
        let id: Int
        let name: String
        let season: Int
    }

    struct TeamsRef: Decodable {
        let home: TeamRef
        let away: TeamRef

        struct TeamRef: Decodable {
            let id: Int
            let name: String
        }
    }

    struct GoalsRef: Decodable {
        let home: Int?
        let away: Int?
    }

    struct TeamStatistics: Decodable {
        let team: TeamRef
        let statistics: [StatEntry]

        struct TeamRef: Decodable {
            let id: Int
        }

        struct StatEntry: Decodable {
            let type: String
            let value: StatValue?

            enum StatValue: Decodable {
                case int(Int)
                case string(String)
                case none

                init(from decoder: Decoder) throws {
                    let container = try decoder.singleValueContainer()
                    if container.decodeNil() {
                        self = .none
                    } else if let intVal = try? container.decode(Int.self) {
                        self = .int(intVal)
                    } else if let strVal = try? container.decode(String.self) {
                        self = .string(strVal)
                    } else {
                        self = .none
                    }
                }

                var intValue: Int {
                    switch self {
                    case .int(let v): return v
                    case .string(let s): return Int(s.replacingOccurrences(of: "%", with: "")) ?? 0
                    case .none: return 0
                    }
                }

                var floatValue: Double {
                    switch self {
                    case .int(let v): return Double(v)
                    case .string(let s): return Double(s.replacingOccurrences(of: "%", with: "")) ?? 0
                    case .none: return 0
                    }
                }
            }
        }
    }

    var isFinished: Bool {
        let status = fixture.status.short
        return status == "FT" || status == "AET" || status == "PEN" || status == "WO" || status == "AWD"
    }

    var timestampMs: Int64 {
        Int64(fixture.timestamp) * 1000
    }
}
