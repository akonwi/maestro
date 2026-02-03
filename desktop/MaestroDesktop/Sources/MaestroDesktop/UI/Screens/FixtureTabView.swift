import SwiftUI

struct FixtureTabView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            if let tabId = appState.activeTabId, let binding = appState.fixtureTabBinding(tabId) {
                FixtureDetailView(tab: binding)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("No Fixture Selected")
                        .font(.headline)
                    Text("Select a fixture to view details.")
                        .foregroundStyle(.secondary)
                }
                .padding(16)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
