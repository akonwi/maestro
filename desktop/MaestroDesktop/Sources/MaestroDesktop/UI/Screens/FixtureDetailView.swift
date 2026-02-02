import SwiftUI

struct FixtureDetailView: View {
    let fixture: FixtureSummary

    @EnvironmentObject private var appState: AppState
    @State private var activeTab: Tab
    @State private var formScope: FormScope = .last5
    @State private var stats: FixtureStats?
    @State private var preMatchData: PreMatchData?
    @State private var matchupData: MatchupData?
    @State private var cornerOdds: CornerOddsData?
    @State private var isLoadingOdds = false
    @State private var selectedBetLine: SelectedBetLine?

    private let fixtureRepository = FixtureRepository()
    private let preMatchRepository = PreMatchRepository()

    struct SelectedBetLine: Identifiable {
        let id = UUID()
        let marketId: Int
        let marketName: String
        let lineName: String
        let odds: Int
        let lineValue: Double?
    }

    init(fixture: FixtureSummary) {
        self.fixture = fixture
        self._activeTab = State(initialValue: fixture.isFinished ? .matchStats : .betting)
    }

    enum Tab: String, Identifiable {
        case matchStats = "Match Stats"
        case preMatch = "Pre-match"
        case betting = "Betting"

        var id: String { rawValue }
    }

    private var availableTabs: [Tab] {
        if fixture.isFinished {
            return [.matchStats, .preMatch]
        } else {
            return [.preMatch, .betting]
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding()
                .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            Picker("", selection: $activeTab) {
                ForEach(availableTabs) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            Divider()

            if activeTab == .betting {
                bettingContent
                    .padding(.horizontal)
            } else {
                ScrollView {
                    Group {
                        switch activeTab {
                        case .matchStats:
                            matchStatsContent
                        case .preMatch:
                            preMatchContent
                        case .betting:
                            EmptyView()
                        }
                    }
                    .padding()
                }
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
            matchupData = preMatchRepository.matchupData(for: fixture, scope: formScope)
        }
        .sheet(item: $selectedBetLine) { line in
            BetFormSheet(
                fixture: fixture,
                marketId: line.marketId,
                marketName: line.marketName,
                lineName: line.lineName,
                initialOdds: line.odds,
                lineValue: line.lineValue,
                onSave: { bet in
                    selectedBetLine = nil
                    appState.refreshBets()
                },
                onCancel: {
                    selectedBetLine = nil
                }
            )
        }
    }

    private func loadStats() {
        stats = fixtureRepository.stats(
            for: fixture.id,
            homeId: fixture.homeId,
            awayId: fixture.awayId
        )
        preMatchData = preMatchRepository.preMatchData(for: fixture, scope: formScope)
        matchupData = preMatchRepository.matchupData(for: fixture, scope: formScope)
        loadCornerOdds()
    }

    private func loadCornerOdds() {
        guard !fixture.isFinished else {
            cornerOdds = nil
            return
        }

        // Check cache first
        if let cached = OddsCache.shared.get(fixtureId: fixture.id) {
            cornerOdds = cached
            isLoadingOdds = false
            return
        }

        guard !appState.apiToken.isEmpty else {
            cornerOdds = nil
            return
        }

        isLoadingOdds = true
        let client = APIFootballClient(apiKey: appState.apiToken)
        let fixtureId = fixture.id

        Task {
            do {
                let markets = try await client.getOdds(fixtureId: fixtureId)
                let cornerMarkets = markets.filter { $0.isCornerMarket }

                let converted = cornerMarkets.map { market in
                    CornerMarket(
                        id: market.id,
                        name: market.displayName,
                        lines: market.values.map { line in
                            CornerLine(
                                id: line.id,
                                name: line.lineName,
                                americanOdd: line.americanOdd,
                                value: line.lineValue
                            )
                        }
                    )
                }

                let oddsData = CornerOddsData(markets: converted)

                await MainActor.run {
                    OddsCache.shared.set(fixtureId: fixtureId, data: oddsData)
                    cornerOdds = oddsData
                    isLoadingOdds = false
                }
            } catch {
                await MainActor.run {
                    cornerOdds = nil
                    isLoadingOdds = false
                }
            }
        }
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

                if let matchup = matchupData {
                    Divider()

                    // Attack vs Defense
                    matchupSection(data: matchup)
                }
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

    private var bettingContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Sticky header with stats
            VStack(alignment: .leading, spacing: 16) {
                Picker("", selection: $formScope) {
                    ForEach(FormScope.allCases) { scope in
                        Text(scope.rawValue).tag(scope)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 200)

                // Corner Stats
                if let matchup = matchupData {
                    cornerStatsSection(data: matchup)
                }
            }
            .padding(.top)
            .padding(.bottom, 16)

            Divider()

            // Scrollable odds
            ScrollView {
                cornerOddsSection
                    .padding(.vertical, 16)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func cornerStatsSection(data: MatchupData) -> some View {
        let expectedHome = (data.home.forStats.cornersPerGame + data.away.againstStats.cornersPerGame) / 2
        let expectedAway = (data.away.forStats.cornersPerGame + data.home.againstStats.cornersPerGame) / 2
        let expectedTotal = expectedHome + expectedAway

        return VStack(alignment: .leading, spacing: 12) {
            Text("Corner Stats")
                .font(.headline)

            HStack(spacing: 12) {
                // Home corners
                cornerStatBox(
                    team: data.home.teamName,
                    won: data.home.forStats.cornersPerGame,
                    conceded: data.away.againstStats.cornersPerGame
                )

                // Expected total
                VStack(spacing: 2) {
                    Text(String(format: "%.1f", expectedTotal))
                        .font(.title)
                        .fontWeight(.bold)
                    Text("expected")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(width: 70)

                // Away corners
                cornerStatBox(
                    team: data.away.teamName,
                    won: data.away.forStats.cornersPerGame,
                    conceded: data.home.againstStats.cornersPerGame
                )
            }
        }
    }

    private func cornerStatBox(team: String, won: Double, conceded: Double) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(team)
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(String(format: "%.1f", won))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Text("won")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text(String(format: "%.1f", conceded))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Text("vs conceded")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(6)
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

    private func matchupSection(data: MatchupData) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Attack vs Defense")
                .font(.headline)

            HStack(alignment: .top, spacing: 24) {
                // Home Attack vs Away Defense
                matchupColumn(
                    title: "\(data.home.teamName) ATK",
                    subtitle: "vs \(data.away.teamName) DEF",
                    attackStats: data.home.forStats,
                    defenseStats: data.away.againstStats
                )

                Divider()

                // Away Attack vs Home Defense
                matchupColumn(
                    title: "\(data.away.teamName) ATK",
                    subtitle: "vs \(data.home.teamName) DEF",
                    attackStats: data.away.forStats,
                    defenseStats: data.home.againstStats
                )
            }
        }
    }

    @ViewBuilder
    private var cornerOddsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Corner Odds")
                .font(.headline)

            if isLoadingOdds {
                HStack {
                    ProgressView()
                        .scaleEffect(0.7)
                    Text("Loading odds...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else if let odds = cornerOdds, !odds.markets.isEmpty {
                ForEach(odds.markets) { market in
                    cornerMarketView(market: market)
                }
            } else {
                Text("No corner odds available")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func cornerMarketView(market: CornerMarket) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(market.name)
                .font(.subheadline)
                .fontWeight(.medium)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 8) {
                ForEach(market.lines) { line in
                    cornerLineView(market: market, line: line)
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
    }

    private func cornerLineView(market: CornerMarket, line: CornerLine) -> some View {
        VStack(spacing: 4) {
            Text(line.name)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Text(line.formattedOdd)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(line.americanOdd > 0 ? .green : .primary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(nsColor: .textBackgroundColor))
        .cornerRadius(6)
        .contentShape(Rectangle())
        .onTapGesture {
            selectedBetLine = SelectedBetLine(
                marketId: market.id,
                marketName: market.name,
                lineName: line.name,
                odds: line.americanOdd,
                lineValue: line.value
            )
        }
        .onHover { hovering in
            if hovering {
                NSCursor.pointingHand.push()
            } else {
                NSCursor.pop()
            }
        }
    }

    private func matchupColumn(title: String, subtitle: String, attackStats: MatchupStats, defenseStats: MatchupStats) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 8) {
                MatchupBar(label: "Shots/Game", attackValue: attackStats.shotsPerGame, defenseValue: defenseStats.shotsPerGame)
                MatchupBar(label: "On Target/Game", attackValue: attackStats.shotsOnTargetPerGame, defenseValue: defenseStats.shotsOnTargetPerGame)
                MatchupBar(label: "xG/Game", attackValue: attackStats.xgPerGame, defenseValue: defenseStats.xgPerGame)
                MatchupBar(label: "Corners/Game", attackValue: attackStats.cornersPerGame, defenseValue: defenseStats.cornersPerGame)
            }
        }
        .frame(maxWidth: .infinity)
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
