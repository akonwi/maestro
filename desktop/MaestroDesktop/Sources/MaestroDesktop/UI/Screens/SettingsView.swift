import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var tokenDraft: String = ""
    @State private var openAIKeyDraft: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Settings")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Text("API-Football Token")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                SecureField("Enter token", text: $tokenDraft)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("OpenAI API Key")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                SecureField("sk-...", text: $openAIKeyDraft)
                    .textFieldStyle(.roundedBorder)
                Text("Used for AI corner analysis")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            HStack {
                Button("Clear All") {
                    tokenDraft = ""
                    openAIKeyDraft = ""
                    appState.updateApiToken("")
                    appState.updateOpenAIKey("")
                }
                .buttonStyle(.bordered)

                Spacer()

                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(.bordered)
                .keyboardShortcut(.cancelAction)

                Button("Save") {
                    appState.updateApiToken(tokenDraft)
                    appState.updateOpenAIKey(openAIKeyDraft)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 400)
        .onAppear {
            tokenDraft = appState.apiToken
            openAIKeyDraft = appState.openAIKey
        }
    }
}
