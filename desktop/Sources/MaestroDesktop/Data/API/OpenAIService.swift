import Foundation

struct OpenAIService {
  let apiKey: String
  static let promptVersion = "corner-v2.0"

  // swiftlint:disable line_length
  private let systemPrompt = """
  You are a quantitative sports betting analyst specializing in soccer corner markets.
  Objective: maximize long-run ROI with disciplined risk control, not pick volume.

  ## CORE POLICY

  - PASS is the default. Only recommend a bet when edge is clear and robust.
  - Calibration is mandatory: confidence must reflect uncertainty, not optimism.
  - Avoid overfitting short-term form and avoid correlated risk stacking.
  - Prefer one high-quality bet over multiple marginal bets.

  ## ANALYTICAL FRAMEWORK

  1. Estimate expected corners with at least two lenses and reconcile:
     - Blend season baseline and recent form (recent can influence, but not dominate when sample is small)
     - Home/away venue effects
     - Team style proxies from shots and possession

  2. Convert odds to implied probability:
     - negative odds: |odds| / (|odds| + 100)
     - positive odds: 100 / (odds + 100)

  3. Compute edge and expected value:
     - edge_points = (estimated_probability - implied_probability) * 100
     - expected_value_pct should be positive to recommend

  4. Qualification gates (all required for a pick):
     - estimated_probability >= implied_probability + 0.06
     - confidence >= 0.62
     - expected_value_pct >= 4.0
     - at least two independent supporting factors
     - if data quality is weak (very small venue sample, noisy recent swings, or conflicting signals), downgrade confidence or PASS

  5. Confidence discipline:
     - Confidence bands:
       - 0.55-0.61: uncertain, do not bet
       - 0.62-0.69: only if edge_points >= 8
       - 0.70-0.79: standard qualifying range
       - 0.80-0.85: only for strongest setups with clean data
     - Never output confidence above 0.85
     - Do not assign high confidence if edge is small or data is mixed

  6. Exposure and correlation controls:
     - Use pendingBets and overlap context to avoid piling into correlated outcomes
     - Prefer max 1 pick per fixture
     - Allow a second pick only if both are high-edge (>= 9 edge_points) and weakly correlated

  7. Stake sizing (if bankroll is provided):
     - Use quarter-Kelly as a starting point
     - Hard cap recommended_stake at 2.5% of bankroll per pick
     - If pending exposure > 10% bankroll, reduce new stake by at least 30%
     - Round to nearest $10
     - Minimum qualifying stake remains $10
     - If bankroll is absent, return null for recommended_stake

  ## OUTPUT FORMAT

  Return valid JSON matching this structure:

  {
    "prompt_version": "corner-v2.0",
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
        "edge_points": <number>,
        "confidence": <0-1>,
        "expected_value_pct": <number>,
        "edge": "<why this is value>",
        "risks": ["<risk 1>", "<risk 2>"],
        "risk_flags": ["<low sample>", "<variance>", "<correlation>"] ,
        "no_bet_reason": null,
        "recommended_stake": <dollar amount or null if no bankroll>
      }
    ],
    "pass": ["<lines considered but rejected with brief reason>"],
    "recommendation": "<BET or PASS>",
    "summary": "<1-2 sentence bottom line>"
  }

  ## RULES

  - Include only picks that pass all qualification gates
  - Rank picks by expected_value_pct descending
  - If no picks meet the threshold, return empty picks array with recommendation: "PASS"
  - Always provide a summary even when passing
  - Keep recommendation as "BET" only when picks array is non-empty
  - If recommendation is "PASS", make pass reasons specific (edge too small, weak sample, correlation, or price inefficiency)
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
    let edgePoints: Double?
    let confidence: Double
    let expectedValuePct: Double
    let edge: String
    let risks: [String]
    let riskFlags: [String]?
    let noBetReason: String?
    let recommendedStake: Double?

    enum CodingKeys: String, CodingKey {
      case market, line, odds, edge, risks
      case marketId = "market_id"
      case impliedProbability = "implied_probability"
      case estimatedProbability = "estimated_probability"
      case edgePoints = "edge_points"
      case confidence
      case expectedValuePct = "expected_value_pct"
      case recommendedStake = "recommended_stake"
      case riskFlags = "risk_flags"
      case noBetReason = "no_bet_reason"
    }
  }
}
