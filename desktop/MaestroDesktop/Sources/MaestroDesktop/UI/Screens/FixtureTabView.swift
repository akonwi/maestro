import SwiftUI

struct FixtureTabView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            if let active = appState.openFixtures.first(where: { $0.id == appState.activeTabId }) {
                FixtureDetailView(fixture: active.fixture)
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
