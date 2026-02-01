import SwiftUI

struct FixtureDetailView: View {
    let fixture: FixtureSummary

    @State private var activeTab: Tab = .matchStats

    enum Tab: String, CaseIterable, Identifiable {
        case matchStats = "Match Stats"
        case preMatch = "Pre-match"

        var id: String { rawValue }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            GroupBox {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Status: \(fixture.status)")
                        .font(.headline)
                    Text("\(fixture.homeName) — \(fixture.awayName)")
                        .font(.title3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Picker("", selection: $activeTab) {
                ForEach(Tab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)

            GroupBox {
                Text(activeTab == .matchStats ? "Match stats content" : "Pre-match content")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Spacer()
        }
        .padding(12)
    }
}
