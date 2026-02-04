import Foundation

@MainActor
final class ChatService {
    private let apiKey: String
    private var wireMessages: [[String: Any]] = []
    private let maxToolIterations = 5

    init(apiKey: String) {
        self.apiKey = apiKey
        wireMessages = [systemMessage]
    }

    func send(userMessage: String) async throws -> [ChatMessage] {
        wireMessages.append([
            "role": "user",
            "content": userMessage,
        ])

        var responses: [ChatMessage] = []
        var iterations = 0

        while iterations < maxToolIterations {
            iterations += 1
            let (content, toolCalls) = try await callAPI()

            guard let toolCalls, !toolCalls.isEmpty else {
                if let content {
                    let msg = ChatMessage(role: .assistant, content: content)
                    responses.append(msg)
                }
                break
            }

            // Append assistant message with tool_calls
            var assistantMsg: [String: Any] = ["role": "assistant"]
            if let content { assistantMsg["content"] = content }
            assistantMsg["tool_calls"] = toolCalls
            wireMessages.append(assistantMsg)

            // Execute each tool call and append results
            for call in toolCalls {
                guard let callId = call["id"] as? String,
                      let function = call["function"] as? [String: Any],
                      let name = function["name"] as? String else {
                    continue
                }

                let argsString = function["arguments"] as? String ?? "{}"
                let arguments = parseArguments(argsString)
                let result = ChatTools.execute(name: name, arguments: arguments)

                wireMessages.append([
                    "role": "tool",
                    "tool_call_id": callId,
                    "content": result,
                ])
            }
        }

        if responses.isEmpty {
            responses.append(ChatMessage(
                role: .assistant,
                content: "I wasn't able to produce a response. Please try rephrasing your question."
            ))
        }

        return responses
    }

    func clearHistory() {
        wireMessages = [systemMessage]
    }

    // MARK: - Private

    private var systemMessage: [String: Any] {
        [
            "role": "system",
            "content": """
            You are a quantitative soccer analyst embedded in a desktop app called Maestro. \
            The user tracks fixtures, leagues, and places corner bets. Your job is to help them \
            make money and protect their bankroll.

            ## Principles
            - Be rigorous: back every claim with data from the tools. Never guess or fabricate numbers.
            - Be honest: if the data doesn't support a conclusion, say so. "I don't see an edge" is a valid answer.
            - Protect the bankroll: when discussing bets, flag risks and highlight where the user may be overexposed.
            - Quality over quantity: one clear insight beats three vague ones.

            ## Tools
            You have access to the user's local database. Always query it before answering — do not rely on assumptions.
            - Call get_followed_leagues first if you need to discover league/season IDs.
            - Call get_all_bets or get_bet_stats to answer questions about betting performance.
            - Call get_fixtures_for_date, get_fixture_stats, or get_league_standings for match and league data.

            ## Style
            - Be concise. Lead with the answer, then supporting data.
            - Format numbers clearly: percentages, currency, odds.
            - When analyzing bets, state probabilities and expected value explicitly.
            - If the user asks about a trend, show the underlying numbers so they can verify.
            """,
        ]
    }

    private func callAPI() async throws -> (content: String?, toolCalls: [[String: Any]]?) {
        let url = URL(string: "https://api.openai.com/v1/chat/completions")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "model": "gpt-4o",
            "messages": wireMessages,
            "tools": ChatTools.definitions(),
            "tool_choice": "auto",
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ChatError.httpError(httpResponse.statusCode, errorBody)
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let choice = choices.first,
              let message = choice["message"] as? [String: Any] else {
            throw ChatError.parseError("Could not parse API response")
        }

        let content = message["content"] as? String
        let toolCalls = message["tool_calls"] as? [[String: Any]]

        return (content, toolCalls)
    }

    private func parseArguments(_ jsonString: String) -> [String: Any] {
        guard let data = jsonString.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return parsed
    }

    enum ChatError: LocalizedError {
        case invalidResponse
        case httpError(Int, String)
        case parseError(String)

        var errorDescription: String? {
            switch self {
            case .invalidResponse:
                return "Invalid response from OpenAI."
            case .httpError(let code, let body):
                return "OpenAI error (\(code)): \(body)"
            case .parseError(let msg):
                return "Failed to parse response: \(msg)"
            }
        }
    }
}
