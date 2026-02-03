import Foundation

struct OpenAIService {
  let apiKey: String

  private let promptId = "pmpt_69801f43970c8195bbfcd5c516a884c1023c91ebbcd4a4c4"
  private let promptVersion = "4"

  private func debugLog(_ msg: String) {
    let path = NSHomeDirectory() + "/maestro_debug.log"
    let line = "[\(Date())] \(msg)\n"
    if let data = line.data(using: .utf8) {
      if FileManager.default.fileExists(atPath: path) {
        if let handle = FileHandle(forWritingAtPath: path) {
          handle.seekToEndOfFile()
          handle.write(data)
          handle.closeFile()
        }
      } else {
        FileManager.default.createFile(atPath: path, contents: data)
      }
    }
  }

  func analyzeCorners(payload: CornerAnalysisPayload) async throws -> CornerAnalysisResponse {
    guard !apiKey.isEmpty else {
      throw OpenAIError.missingApiKey
    }

    let url = URL(string: "https://api.openai.com/v1/responses")!

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let payloadJson = try JSONEncoder().encode(payload)
    let payloadString = String(data: payloadJson, encoding: .utf8) ?? "{}"

    debugLog("[OpenAI] Payload markets: \(payload.markets.map { $0.name })")

    let body: [String: Any] = [
      "prompt": [
        "id": promptId,
        "version": promptVersion,
      ],
      "input": "Analyze this fixture for corner betting value:\n\n\(payloadString)",
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

    // Debug: log raw response
    let rawResponse = String(data: data, encoding: .utf8) ?? "Unable to decode"
    debugLog("[OpenAI] Raw response: \(rawResponse)")

    let openAIResponse = try JSONDecoder().decode(OpenAIResponseWrapper.self, from: data)

    guard let outputText = openAIResponse.output else {
      throw OpenAIError.noOutput
    }

    debugLog("[OpenAI] Parsed output: \(outputText)")

    // Parse the JSON from the output
    guard let jsonData = outputText.data(using: .utf8) else {
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

// MARK: - Response Wrapper

private struct OpenAIResponseWrapper: Decodable {
  let output: String?

  enum CodingKeys: String, CodingKey {
    case output
    case choices
  }

  enum ChoiceKeys: String, CodingKey {
    case message
  }

  enum MessageKeys: String, CodingKey {
    case content
  }

  // Responses API nested structure
  struct OutputItem: Decodable {
    let content: [ContentItem]?
  }

  struct ContentItem: Decodable {
    let type: String?
    let text: String?
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    // Try Responses API format: output is an array of message objects
    if let outputItems = try? container.decode([OutputItem].self, forKey: .output) {
      // Find the first content item with text
      for item in outputItems {
        if let contents = item.content {
          for content in contents {
            if let text = content.text, !text.isEmpty {
              // Strip markdown code block wrapper if present
              self.output = Self.stripMarkdownCodeBlock(text)
              return
            }
          }
        }
      }
    }

    // Try direct output field (simple string)
    if let output = try? container.decode(String.self, forKey: .output) {
      self.output = Self.stripMarkdownCodeBlock(output)
      return
    }

    // Fall back to choices array (Chat Completions API format)
    if var choices = try? container.nestedUnkeyedContainer(forKey: .choices) {
      if let choice = try? choices.nestedContainer(keyedBy: ChoiceKeys.self) {
        let message = try choice.nestedContainer(keyedBy: MessageKeys.self, forKey: .message)
        let content = try message.decode(String.self, forKey: .content)
        self.output = Self.stripMarkdownCodeBlock(content)
        return
      }
    }

    self.output = nil
  }

  private static func stripMarkdownCodeBlock(_ text: String) -> String {
    var result = text.trimmingCharacters(in: .whitespacesAndNewlines)

    // Remove ```json or ``` prefix
    if result.hasPrefix("```json") {
      result = String(result.dropFirst(7))
    } else if result.hasPrefix("```") {
      result = String(result.dropFirst(3))
    }

    // Remove ``` suffix
    if result.hasSuffix("```") {
      result = String(result.dropLast(3))
    }

    return result.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}

// MARK: - Analysis Payload

struct CornerAnalysisPayload: Encodable {
  let fixture: FixtureInfo
  let homeTeam: TeamAnalysisData
  let awayTeam: TeamAnalysisData
  let markets: [MarketData]

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
    let market: String
    let line: String
    let odds: Int
    let impliedProbability: Double
    let estimatedProbability: Double
    let confidence: Double
    let expectedValuePct: Double
    let edge: String
    let risks: [String]

    enum CodingKeys: String, CodingKey {
      case market, line, odds, edge, risks
      case impliedProbability = "implied_probability"
      case estimatedProbability = "estimated_probability"
      case confidence
      case expectedValuePct = "expected_value_pct"
    }
  }
}
