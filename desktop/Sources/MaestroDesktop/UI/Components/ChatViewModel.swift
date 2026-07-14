import Foundation

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var status: ChatStatus = .idle

    private var chatService: ChatService?

    func configure(apiKey: String) {
        guard !apiKey.isEmpty else {
            chatService = nil
            return
        }
        if chatService == nil {
            chatService = ChatService(apiKey: apiKey)
        }
    }

    var isConfigured: Bool { chatService != nil }

    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        messages.append(ChatMessage(role: .user, content: trimmed))
        status = .thinking

        do {
            let responses = try await chatService!.send(userMessage: trimmed)
            messages.append(contentsOf: responses)
            status = .idle
        } catch {
            status = .error(error.localizedDescription)
        }
    }

    func clearChat() {
        messages.removeAll()
        chatService?.clearHistory()
        status = .idle
    }
}
