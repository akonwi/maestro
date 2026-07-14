import SwiftUI

struct ChatFloatingButton: View {
    @Binding var isChatOpen: Bool

    var body: some View {
        Button {
            withAnimation(.spring(duration: 0.25)) {
                isChatOpen.toggle()
            }
        } label: {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(Circle().fill(Color.accentColor))
                .shadow(radius: 4)
        }
        .buttonStyle(.plain)
        .help("Chat with AI assistant")
    }
}
