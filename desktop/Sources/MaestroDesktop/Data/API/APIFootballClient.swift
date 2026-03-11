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

    struct OddsResult {
        let markets: [APIOddsMarket]
        let bookmaker: BookmakerInfo?
    }

    func getOdds(fixtureId: Int, bookmakerId: Int = 8) async throws -> OddsResult {
        let response: OddsResponse = try await request(path: "/odds?fixture=\(fixtureId)&bookmaker=\(bookmakerId)")
        guard let bookmaker = response.response.first?.bookmakers.first else {
            return OddsResult(markets: [], bookmaker: nil)
        }
        return OddsResult(
            markets: bookmaker.bets,
            bookmaker: BookmakerInfo(id: bookmaker.id, name: bookmaker.name)
        )
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

// MARK: - Odds

struct OddsResponse: Decodable {
    let response: [OddsFixture]

    struct OddsFixture: Decodable {
        let bookmakers: [Bookmaker]
    }

    struct Bookmaker: Decodable {
        let id: Int
        let name: String
        let bets: [APIOddsMarket]
    }
}

struct APIOddsMarket: Codable, Equatable, Identifiable {
    let id: Int
    let name: String
    let values: [APIOddsLine]

    static let goalsTotal = 5
    static let bothTeamsScore = 8
    static let goalsHome = 16
    static let goalsAway = 17

    static let cornersTotal = 45
    static let cornersMoneyline = 55
    static let cornersAsian = 56
    static let cornersHome = 57
    static let cornersAway = 58
    static let cornersTotal3Way = 85

    var isGoalMarket: Bool {
        [Self.goalsTotal, Self.bothTeamsScore, Self.goalsHome, Self.goalsAway].contains(id)
    }

    var isCornerMarket: Bool {
        [Self.cornersTotal, Self.cornersMoneyline, Self.cornersAsian,
         Self.cornersHome, Self.cornersAway, Self.cornersTotal3Way].contains(id)
    }

    var displayName: String {
        switch id {
        case Self.goalsTotal: return "Goals Over/Under"
        case Self.bothTeamsScore: return "Both Teams Score"
        case Self.goalsHome: return "Total - Home"
        case Self.goalsAway: return "Total - Away"
        case Self.cornersTotal: return "Total Corners"
        case Self.cornersMoneyline: return "Most Corners"
        case Self.cornersAsian: return "Asian Corners"
        case Self.cornersHome: return "Home Corners"
        case Self.cornersAway: return "Away Corners"
        case Self.cornersTotal3Way: return "Total Corners (3-Way)"
        default: return name
        }
    }
}

struct APIOddsLine: Codable, Equatable, Identifiable {
    let value: OddsValue
    let odd: String

    var id: String { value.stringValue }

    enum OddsValue: Codable, Equatable {
        case string(String)
        case int(Int)

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let str = try? container.decode(String.self) {
                self = .string(str)
            } else if let num = try? container.decode(Int.self) {
                self = .int(num)
            } else {
                self = .string("")
            }
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case .string(let value):
                try container.encode(value)
            case .int(let value):
                try container.encode(value)
            }
        }

        var stringValue: String {
            switch self {
            case .string(let s): return s
            case .int(let i): return String(i)
            }
        }
    }

    var lineName: String {
        value.stringValue
    }

    var decimalOdd: Double {
        Double(odd) ?? 0
    }

    var americanOddValue: Int? {
        let dec = decimalOdd
        guard dec.isFinite, dec > 1.0 else { return nil }

        if dec < 2.0 {
            let denominator = dec - 1.0
            guard denominator.isFinite, abs(denominator) > 0.0001 else { return nil }
            let american = -100.0 / denominator
            guard american.isFinite else { return nil }
            return Int(american.rounded())
        } else {
            let american = (dec - 1.0) * 100.0
            guard american.isFinite else { return nil }
            return Int(american.rounded())
        }
    }

    var americanOdd: Int {
        americanOddValue ?? 0
    }

    var lineType: LineType {
        let name = lineName
        if name.hasPrefix("Over") { return .over }
        if name.hasPrefix("Under") { return .under }
        if name.hasPrefix("Home") { return .home }
        if name.hasPrefix("Away") { return .away }
        if name.hasPrefix("Exactly") { return .exactly }
        if name == "Draw" { return .draw }
        return .other
    }

    var lineValue: Double? {
        let parts = lineName.split(separator: " ")
        guard parts.count == 2 else { return nil }
        return Double(parts[1])
    }

    enum LineType {
        case over, under, home, away, exactly, draw, other
    }
}
