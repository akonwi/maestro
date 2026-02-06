import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var tokenDraft: String = ""
    @State private var openAIKeyDraft: String = ""
    @State private var bankrollDraft: Double = 0

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

            VStack(alignment: .leading, spacing: 8) {
                Text("Bankroll")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                HStack {
                    Text("$")
                    TextField("0", value: $bankrollDraft, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 100)
                }
                Text("Your total betting bankroll for stake sizing recommendations")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            HStack {
                Button("Clear All") {
                    tokenDraft = ""
                    openAIKeyDraft = ""
                    bankrollDraft = 0
                    appState.updateApiToken("")
                    appState.updateOpenAIKey("")
                    appState.updateBankroll(0)
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
                    appState.updateBankroll(bankrollDraft)
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
            bankrollDraft = appState.bankroll
        }
    }
}
