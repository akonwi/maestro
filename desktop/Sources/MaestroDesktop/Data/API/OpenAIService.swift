import Foundation

struct OpenAIService {
  let apiKey: String

  // swiftlint:disable line_length
  private let systemPrompt = """
  You are a quantitative sports betting analyst specializing in soccer corner markets. Your goal is to MAKE MONEY by identifying high-value bets where you have a significant edge over the market.

  ## PRINCIPLES

  - Protect the bankroll: only recommend bets where you're genuinely confident
  - Quality over quantity: one strong pick beats three marginal ones
  - Be honest when there's no edge—passing is a valid recommendation

  ## ANALYTICAL FRAMEWORK

  1. Calculate expected corners using multiple methods:
     - Average of (Team A corners won + Team B corners conceded) and vice versa
     - Weight recent form (last 5) more heavily than season averages
     - Adjust for home/away venue effects
     - Look for trends in the raw fixture data (increasing/decreasing patterns)

  2. Convert odds to implied probability:
     - American odds to probability: negative odds → |odds|/(|odds|+100), positive → 100/(odds+100)

  3. Identify edges:
     - Compare your probability estimate to implied probability
     - Tiered edge thresholds:
       - Strong pick: edge > 5% AND confidence ≥ 70%
       - Standard pick: edge > 3% AND confidence ≥ 80%
       - Lean pick: edge > 2% AND confidence ≥ 85%
     - All three tiers are valid recommendations—consistent moderate wins compound over time
     - Do NOT require a large edge to recommend a bet. A 3% edge at high confidence is actionable.

  4. Be rigorous but not paralyzed:
     - State your probability estimate explicitly
     - Show your reasoning
     - List concrete reasons a bet could lose
     - If no clear edge exists, recommend PASS—don't force picks
     - But do not pass on lines where the data supports an edge just because the edge is small. Small edges at high confidence are profitable long-term.

  5. Use bankroll context (if provided):
     - The input may include a bettingProfile with:
       - bankroll: total betting capital available
       - Track record: total bets, win rate, ROI, net profit, total staked
     - The input may also include pendingBets—unsettled bets currently at risk
     - Factor pending exposure into recommendations:
       - If there's already significant stake in flight, be more selective
       - If a pending bet overlaps with a market you're analyzing, note the existing exposure and avoid recommending correlated bets that compound risk

  6. Stake sizing (when bankroll is provided):
     - Use a conservative fractional Kelly Criterion approach:
       - Kelly fraction = (edge * confidence) / (odds_decimal - 1)
       - Apply a 0.25x Kelly multiplier for safety (quarter Kelly)
       - Never recommend more than 5% of bankroll on a single bet
       - Minimum stake: $10 (1 unit) — if Kelly suggests less, still recommend $10 for qualifying picks
     - Adjust for pending exposure:
       - Calculate total pending stake from pendingBets
       - Reduce recommended stake if pending exposure exceeds 10% of bankroll
     - Round stakes to nearest $10 for practical betting
     - If no bankroll provided, omit recommended_stake from picks

  ## OUTPUT FORMAT

  Return valid JSON matching this structure:

  {
    "analysis": {
      "expected_total_corners": <number>,
      "expected_home_corners": <number>,
      "expected_away_corners": <number>,
      "method": "<brief explanation>",
      "key_factors": ["<factor 1>", "<factor 2>"]
    },
    "picks": [
      {
        "market_id": <market id from input>,
        "market": "<market name>",
        "line": "<line name>",
        "odds": <american odds>,
        "implied_probability": <0-1>,
        "estimated_probability": <0-1>,
        "confidence": <0-1>,
        "expected_value_pct": <number>,
        "edge": "<why this is value>",
        "risks": ["<risk 1>", "<risk 2>"],
        "recommended_stake": <dollar amount or null if no bankroll>
      }
    ],
    "pass": ["<lines considered but rejected with brief reason>"],
    "recommendation": "<BET or PASS>",
    "summary": "<1-2 sentence bottom line>"
  }

  ## RULES

  - Include picks that meet any of the tiered thresholds (strong/standard/lean) and have positive expected value
  - Rank picks by expected_value_pct descending
  - If no picks meet the threshold, return empty picks array with recommendation: "PASS"
  - Always provide a summary even when passing
  - IMPORTANT: You must analyze EVERY market provided in the input. Each line from each market must appear either in picks (if it meets the threshold) or in pass (with a brief reason for rejection). Do not skip any markets.
  - Return ONLY valid JSON. No markdown code blocks, no commentary outside the JSON.
  """
  // swiftlint:enable line_length

  func analyzeCorners(payload: CornerAnalysisPayload) async throws -> CornerAnalysisResponse {
    guard !apiKey.isEmpty else {
      throw OpenAIError.missingApiKey
    }

    let url = URL(string: "https://api.openai.com/v1/chat/completions")!

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let payloadJson = try JSONEncoder().encode(payload)
    let payloadString = String(data: payloadJson, encoding: .utf8) ?? "{}"

    let body: [String: Any] = [
      "model": "gpt-4o",
      "messages": [
        ["role": "system", "content": systemPrompt],
        ["role": "user", "content": "Analyze this fixture for corner betting value:\n\n\(payloadString)"],
      ],
      "response_format": ["type": "json_object"],
    ]

    request.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse else {
      throw OpenAIError.invalidResponse
    }

    guard httpResponse.statusCode == 200 else {
      let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
      throw OpenAIError.httpError(httpResponse.statusCode, errorBody)
    }

    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let choices = json["choices"] as? [[String: Any]],
          let choice = choices.first,
          let message = choice["message"] as? [String: Any],
          let content = message["content"] as? String else {
      throw OpenAIError.noOutput
    }

    guard let jsonData = content.data(using: .utf8) else {
      throw OpenAIError.parseError("Could not convert output to data")
    }

    return try JSONDecoder().decode(CornerAnalysisResponse.self, from: jsonData)
  }

  enum OpenAIError: LocalizedError {
    case missingApiKey
    case invalidResponse
    case httpError(Int, String)
    case noOutput
    case parseError(String)

    var errorDescription: String? {
      switch self {
      case .missingApiKey:
        return "OpenAI API key not configured. Add it in Settings."
      case .invalidResponse:
        return "Invalid response from OpenAI."
      case .httpError(let code, let body):
        return "OpenAI error (\(code)): \(body)"
      case .noOutput:
        return "No output from OpenAI."
      case .parseError(let msg):
        return "Failed to parse response: \(msg)"
      }
    }
  }
}

// MARK: - Analysis Payload

struct CornerAnalysisPayload: Encodable {
  let fixture: FixtureInfo
  let homeTeam: TeamAnalysisData
  let awayTeam: TeamAnalysisData
  let markets: [MarketData]
  let bettingProfile: BettingProfile?
  let pendingBets: [PendingBet]?

  struct FixtureInfo: Encodable {
    let home: String
    let away: String
  }

  struct TeamAnalysisData: Encodable {
    let name: String
    let seasonGames: Int
    let seasonCornersFor: Double
    let seasonCornersAgainst: Double
    let venueCornersFor: Double
    let venueCornersAgainst: Double
    let venueGames: Int
    let shotsPerGame: Double
    let possessionAvg: Double
    let recentForm: [RecentFixture]
  }

  struct RecentFixture: Encodable {
    let opponent: String
    let venue: String  // "H" or "A"
    let cornersWon: Int
    let cornersConceded: Int
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
    let market: String
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

// MARK: - Analysis Response

struct CornerAnalysisResponse: Codable {
  let analysis: Analysis
  let picks: [Pick]
  let pass: [String]
  let recommendation: String
  let summary: String

  struct Analysis: Codable {
    let expectedTotalCorners: Double
    let expectedHomeCorners: Double
    let expectedAwayCorners: Double
    let method: String
    let keyFactors: [String]

    enum CodingKeys: String, CodingKey {
      case expectedTotalCorners = "expected_total_corners"
      case expectedHomeCorners = "expected_home_corners"
      case expectedAwayCorners = "expected_away_corners"
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
    let confidence: Double
    let expectedValuePct: Double
    let edge: String
    let risks: [String]
    let recommendedStake: Double?

    enum CodingKeys: String, CodingKey {
      case market, line, odds, edge, risks
      case marketId = "market_id"
      case impliedProbability = "implied_probability"
      case estimatedProbability = "estimated_probability"
      case confidence
      case expectedValuePct = "expected_value_pct"
      case recommendedStake = "recommended_stake"
    }
  }
}
