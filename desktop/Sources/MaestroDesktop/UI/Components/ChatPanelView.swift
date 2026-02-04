import SwiftUI

struct ChatPanelView: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var inputText = ""

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            Divider()

            if viewModel.isConfigured {
                messageList
                Divider()
                inputBar
            } else {
                unconfiguredView
            }
        }
        .frame(width: 380, height: 500)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.2), radius: 16, x: 0, y: 8)
    }

    private var headerBar: some View {
        HStack {
            Text("Chat")
                .font(.headline)
            Spacer()
            if viewModel.isConfigured && !viewModel.messages.isEmpty {
                Button {
                    viewModel.clearChat()
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Clear chat")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(viewModel.messages) { message in
                        ChatBubbleView(message: message)
                            .id(message.id)
                    }

                    if viewModel.status == .thinking {
                        thinkingIndicator
                            .id("thinking")
                    }

                    if case .error(let msg) = viewModel.status {
                        Text(msg)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .padding(.horizontal, 4)
                            .id("error")
                    }
                }
                .padding(12)
            }
            .onAppear {
                if let last = viewModel.messages.last {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
            .onChange(of: viewModel.messages.count) {
                withAnimation {
                    if let last = viewModel.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
            .onChange(of: viewModel.status) {
                withAnimation {
                    if viewModel.status == .thinking {
                        proxy.scrollTo("thinking", anchor: .bottom)
                    }
                }
            }
        }
    }

    private var thinkingIndicator: some View {
        HStack(spacing: 6) {
            ProgressView()
                .controlSize(.small)
            Text("Thinking...")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Ask about your data...", text: $inputText)
                .textFieldStyle(.plain)
                .onSubmit { sendMessage() }

            Button {
                sendMessage()
            } label: {
                Image(systemName: "paperplane.fill")
                    .foregroundStyle(canSend ? Color.accentColor : .secondary)
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
        }
        .padding(12)
    }

    private var unconfiguredView: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "key")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Configure your OpenAI API key in Settings to use the chat assistant.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .font(.callout)
                .padding(.horizontal, 24)
            Spacer()
        }
    }

    private var canSend: Bool {
        viewModel.status != .thinking && !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func sendMessage() {
        guard canSend else { return }
        let text = inputText
        inputText = ""
        Task {
            await viewModel.send(text)
        }
    }
}
