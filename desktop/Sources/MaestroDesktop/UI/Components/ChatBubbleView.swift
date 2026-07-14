import SwiftUI

struct ChatBubbleView: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 60) }

            Text(message.content)
                .padding(10)
                .background(bubbleColor)
                .foregroundStyle(message.role == .user ? .white : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .textSelection(.enabled)

            if message.role == .assistant { Spacer(minLength: 60) }
        }
    }

    private var bubbleColor: Color {
        message.role == .user
            ? Color.accentColor
            : Color(nsColor: .controlBackgroundColor)
    }
}
