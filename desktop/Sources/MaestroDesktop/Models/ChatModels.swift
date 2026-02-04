import Foundation

enum ChatRole: String {
    case system
    case user
    case assistant
    case tool
}

struct ChatMessage: Identifiable, Equatable {
    let id: UUID
    let role: ChatRole
    let content: String
    let timestamp: Date

    init(
        id: UUID = UUID(),
        role: ChatRole,
        content: String,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
    }

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id
    }
}

enum ChatStatus: Equatable {
    case idle
    case thinking
    case error(String)
}
