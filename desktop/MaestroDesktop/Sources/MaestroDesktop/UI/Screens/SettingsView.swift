import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var tokenDraft: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Settings")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Text("API-Football Token")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextField("Enter token", text: $tokenDraft)
                    .textFieldStyle(.roundedBorder)
            }

            HStack {
                Button("Clear") {
                    tokenDraft = ""
                    appState.updateApiToken("")
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
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 400)
        .onAppear { tokenDraft = appState.apiToken }
    }
}
