import SwiftUI

struct FixtureDetailView: View {
    let fixture: FixtureSummary

    @State private var activeTab: Tab = .matchStats
    @State private var stats: FixtureStats?

    private let fixtureRepository = FixtureRepository()

    enum Tab: String, CaseIterable, Identifiable {
        case matchStats = "Match Stats"
        case preMatch = "Pre-match"

        var id: String { rawValue }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding()
                .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            Picker("", selection: $activeTab) {
                ForEach(Tab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            Divider()

            ScrollView {
                Group {
                    if activeTab == .matchStats {
                        matchStatsContent
                    } else {
                        preMatchContent
                    }
                }
                .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            loadStats()
        }
    }

    private func loadStats() {
        stats = fixtureRepository.stats(
            for: fixture.id,
            homeId: fixture.homeId,
            awayId: fixture.awayId
        )
    }

    private var header: some View {
        VStack(spacing: 12) {
            HStack(alignment: .center, spacing: 24) {
                // Home team
                VStack(spacing: 8) {
                    teamLogo(url: fixture.homeLogoURL)
                    Text(fixture.homeName)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)

                // Score or time
                VStack(spacing: 4) {
                    Text("\(dateOnly(fixture.kickoff)) · \(timeOnly(fixture.kickoff))")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if fixture.isFinished {
                        Text("\(fixture.homeGoals) - \(fixture.awayGoals)")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                        Text("FT")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("vs")
                            .font(.system(size: 24, weight: .medium, design: .rounded))
                            .foregroundStyle(.tertiary)
                    }
                }

                // Away team
                VStack(spacing: 8) {
                    teamLogo(url: fixture.awayLogoURL)
                    Text(fixture.awayName)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func teamLogo(url: URL?) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                ProgressView()
                    .frame(width: 48, height: 48)
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 48, height: 48)
            case .failure:
                Image(systemName: "shield")
                    .font(.system(size: 32))
                    .foregroundStyle(.secondary)
                    .frame(width: 48, height: 48)
            @unknown default:
                EmptyView()
            }
        }
    }

    private var matchStatsContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let stats = stats {
                let comparisons = buildComparisons(stats)
                ForEach(comparisons) { stat in
                    StatComparisonRow(stat: stat)
                }
            } else if fixture.isFinished {
                ContentUnavailableView(
                    "No Stats Available",
                    systemImage: "chart.bar",
                    description: Text("Statistics not available for this match.")
                )
            } else {
                ContentUnavailableView(
                    "Match Not Started",
                    systemImage: "clock",
                    description: Text("Stats will be available after kickoff.")
                )
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func buildComparisons(_ stats: FixtureStats) -> [StatComparison] {
        [
            StatComparison(label: "Possession", homeValue: stats.home.possession, awayValue: stats.away.possession, format: .percentage),
            StatComparison(label: "Shots", homeValue: Double(stats.home.shots), awayValue: Double(stats.away.shots), format: .integer),
            StatComparison(label: "Shots on Target", homeValue: Double(stats.home.shotsOnGoal), awayValue: Double(stats.away.shotsOnGoal), format: .integer),
            StatComparison(label: "Corners", homeValue: Double(stats.home.corners), awayValue: Double(stats.away.corners), format: .integer),
            StatComparison(label: "Fouls", homeValue: Double(stats.home.fouls), awayValue: Double(stats.away.fouls), format: .integer),
            StatComparison(label: "Yellow Cards", homeValue: Double(stats.home.yellowCards), awayValue: Double(stats.away.yellowCards), format: .integer),
            StatComparison(label: "Red Cards", homeValue: Double(stats.home.redCards), awayValue: Double(stats.away.redCards), format: .integer),
            StatComparison(label: "Offsides", homeValue: Double(stats.home.offsides), awayValue: Double(stats.away.offsides), format: .integer),
            StatComparison(label: "xG", homeValue: stats.home.xg, awayValue: stats.away.xg, format: .decimal),
        ]
    }

    private var preMatchContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Pre-match analysis will be displayed here.")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func timeOnly(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    private func dateOnly(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}
