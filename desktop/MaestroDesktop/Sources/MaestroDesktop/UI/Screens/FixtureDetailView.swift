import SwiftUI

struct FixtureDetailView: View {
    let fixture: FixtureSummary

    @EnvironmentObject private var appState: AppState
    @State private var activeTab: Tab = .matchStats
    @State private var formScope: FormScope = .last5
    @State private var stats: FixtureStats?
    @State private var preMatchData: PreMatchData?

    private let fixtureRepository = FixtureRepository()
    private let preMatchRepository = PreMatchRepository()

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
        .onChange(of: fixture) {
            loadStats()
        }
        .onChange(of: formScope) {
            preMatchData = preMatchRepository.preMatchData(for: fixture, scope: formScope)
        }
    }

    private func loadStats() {
        stats = fixtureRepository.stats(
            for: fixture.id,
            homeId: fixture.homeId,
            awayId: fixture.awayId
        )
        preMatchData = preMatchRepository.preMatchData(for: fixture, scope: formScope)
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
        VStack(alignment: .leading, spacing: 24) {
            Picker("", selection: $formScope) {
                ForEach(FormScope.allCases) { scope in
                    Text(scope.rawValue).tag(scope)
                }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 200)

            if let data = preMatchData {
                // Form
                formSection(data: data)

                Divider()

                // Stats Comparison
                statsSection(data: data)
            } else {
                ContentUnavailableView(
                    "No Data Available",
                    systemImage: "chart.bar",
                    description: Text("Pre-match stats not available.")
                )
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func formSection(data: PreMatchData) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Form")
                .font(.headline)

            HStack(alignment: .top, spacing: 32) {
                formColumn(team: data.home)
                Divider()
                formColumn(team: data.away)
            }
        }
    }

    private func formColumn(team: TeamPreMatchStats) -> some View {
        VStack(alignment: .center, spacing: 8) {
            if team.form.isEmpty {
                Text("No recent matches")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(team.form) { result in
                            formBadge(result: result)
                        }
                    }
                }
                .frame(maxWidth: 140)

                let stats = team.seasonStats
                Text("\(stats.wins)W \(stats.draws)D \(stats.losses)L")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func formBadge(result: FormResult) -> some View {
        let venue = result.isHome ? "H" : "A"
        let tooltip = "\(venue): \(result.goalsFor)-\(result.goalsAgainst) vs \(result.opponent)\n\(formattedShortDate(result.date))"

        return Text(result.result.rawValue)
            .font(.caption)
            .fontWeight(.bold)
            .foregroundStyle(.white)
            .frame(width: 24, height: 24)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(badgeColor(for: result.result))
            )
            .help(tooltip)
            .contentShape(Rectangle())
            .onTapGesture {
                openFormFixture(id: result.id)
            }
            .onHover { hovering in
                if hovering {
                    NSCursor.pointingHand.push()
                } else {
                    NSCursor.pop()
                }
            }
    }

    private func openFormFixture(id: Int) {
        if let fixture = fixtureRepository.fixture(id: id) {
            appState.openFixture(fixture)
        }
    }

    private func formattedShortDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private func badgeColor(for result: FormResult.MatchResult) -> Color {
        switch result {
        case .win: return .green
        case .draw: return .orange
        case .loss: return .red
        }
    }

    private func statsSection(data: PreMatchData) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Stats")
                .font(.headline)

            let comparisons = buildSeasonComparisons(home: data.home.seasonStats, away: data.away.seasonStats)

            ForEach(comparisons) { stat in
                StatComparisonRow(stat: stat)
            }
        }
    }

    private func buildSeasonComparisons(home: SeasonStats, away: SeasonStats) -> [StatComparison] {
        [
            StatComparison(label: "Win Rate", homeValue: home.winRate, awayValue: away.winRate, format: .percentage),
            StatComparison(label: "Goals Scored", homeValue: Double(home.goalsFor), awayValue: Double(away.goalsFor), format: .integer),
            StatComparison(label: "Goals Conceded", homeValue: Double(home.goalsAgainst), awayValue: Double(away.goalsAgainst), format: .integer),
            StatComparison(label: "xG For", homeValue: home.xgFor, awayValue: away.xgFor, format: .decimal),
            StatComparison(label: "xG Against", homeValue: home.xgAgainst, awayValue: away.xgAgainst, format: .decimal),
            StatComparison(label: "Clean Sheets", homeValue: Double(home.cleanSheets), awayValue: Double(away.cleanSheets), format: .integer),
            StatComparison(label: "Shots/Game", homeValue: home.shotsPerGame, awayValue: away.shotsPerGame, format: .decimal),
            StatComparison(label: "Corners/Game", homeValue: home.cornersPerGame, awayValue: away.cornersPerGame, format: .decimal),
        ]
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
