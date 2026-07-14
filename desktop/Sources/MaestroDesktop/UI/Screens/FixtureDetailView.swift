import SwiftUI

struct FixtureDetailView: View {
    @Binding var tab: FixtureTab

    @EnvironmentObject private var appState: AppState
    @State private var stats: FixtureStats?
    @State private var preMatchData: PreMatchData?
    @State private var matchupData: MatchupData?
    @State private var syncTimer: Timer?

    private let fixtureRepository = FixtureRepository()
    private let preMatchRepository = PreMatchRepository()
    private let syncService = SyncService()

    private var fixture: FixtureSummary { tab.fixture }

    private var isInPlay: Bool {
        !fixture.isFinished && !fixture.isPostponed && fixture.kickoff <= Date()
    }

    private var availableTabs: [FixtureTab.FixtureTabView] {
        if fixture.isFinished || isInPlay {
            return [.matchStats, .preMatch]
        }
        return [.preMatch]
    }

    private var activeTabBinding: Binding<FixtureTab.FixtureTabView> {
        Binding(
            get: {
                if let current = tab.activeTab, availableTabs.contains(current) {
                    return current
                }
                return availableTabs.first ?? .preMatch
            },
            set: { tab.activeTab = $0 }
        )
    }

    private var activeTab: FixtureTab.FixtureTabView {
        activeTabBinding.wrappedValue
    }

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding()
                .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            if availableTabs.count > 1 {
                Picker("", selection: activeTabBinding) {
                    ForEach(availableTabs) { tabView in
                        Text(tabView.rawValue).tag(tabView)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                Divider()
            }

            ScrollView {
                Group {
                    switch activeTab {
                    case .matchStats:
                        matchStatsContent
                    case .preMatch:
                        preMatchContent
                    }
                }
                .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            loadStats()
            startSyncTimerIfNeeded()
        }
        .onDisappear {
            stopSyncTimer()
        }
        .onChange(of: fixture) {
            loadStats()
            stopSyncTimer()
            startSyncTimerIfNeeded()
        }
        .onChange(of: tab.formScope) {
            preMatchData = preMatchRepository.preMatchData(for: fixture, scope: tab.formScope)
            matchupData = preMatchRepository.matchupData(for: fixture, scope: tab.formScope)
        }
    }

    private func loadStats() {
        if let fresh = fixtureRepository.fixture(id: fixture.id) {
            tab.fixture = fresh
        }

        stats = fixtureRepository.stats(
            for: fixture.id,
            homeId: fixture.homeId,
            awayId: fixture.awayId
        )
        preMatchData = preMatchRepository.preMatchData(for: fixture, scope: tab.formScope)
        matchupData = preMatchRepository.matchupData(for: fixture, scope: tab.formScope)
    }

    private var isWithinSyncWindow: Bool {
        guard !fixture.isFinished else { return false }
        let twoHoursFromNow = Date().addingTimeInterval(2 * 60 * 60)
        return fixture.kickoff <= twoHoursFromNow
    }

    private func startSyncTimerIfNeeded() {
        guard isWithinSyncWindow, !appState.apiToken.isEmpty else { return }

        syncFixtureStats()

        syncTimer = Timer.scheduledTimer(withTimeInterval: 10 * 60, repeats: true) { _ in
            Task { @MainActor in
                syncFixtureStats()
            }
        }
    }

    private func stopSyncTimer() {
        syncTimer?.invalidate()
        syncTimer = nil
    }

    private func syncFixtureStats() {
        guard !appState.apiToken.isEmpty else { return }

        Task {
            let success = await syncService.syncFixture(
                id: fixture.id,
                leagueId: fixture.leagueId,
                season: fixture.season,
                apiKey: appState.apiToken
            )
            if success {
                await MainActor.run {
                    loadStats()
                    appState.refreshFixtures()
                }
            }
        }
    }

    private var header: some View {
        let leagueName = appState.followedLeagues.first { $0.id == fixture.leagueId }?.name ?? ""
        let leagueRepository = LeagueRepository()
        let homePosition = leagueRepository.teamPosition(
            teamId: fixture.homeId,
            leagueId: fixture.leagueId,
            season: fixture.season
        )
        let awayPosition = leagueRepository.teamPosition(
            teamId: fixture.awayId,
            leagueId: fixture.leagueId,
            season: fixture.season
        )

        return VStack(spacing: 12) {
            HStack(alignment: .center, spacing: 24) {
                Button {
                    appState.openTeam(
                        teamId: fixture.homeId,
                        teamName: fixture.homeName,
                        leagueId: fixture.leagueId,
                        leagueName: leagueName,
                        season: fixture.season
                    )
                } label: {
                    VStack(spacing: 8) {
                        teamLogo(url: fixture.homeLogoURL)
                        HStack(spacing: 6) {
                            Text(fixture.homeName)
                                .font(.headline)
                                .multilineTextAlignment(.center)
                            TeamPositionView(position: homePosition, size: .small)
                        }
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .contextMenu {
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString("\(fixture.homeId)", forType: .string)
                    } label: {
                        Label("Copy Team ID", systemImage: "doc.on.doc")
                    }
                }

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
                    } else if isInPlay {
                        Text("\(fixture.homeGoals) - \(fixture.awayGoals)")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                        Text("LIVE")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.green)
                    } else {
                        Text("vs")
                            .font(.system(size: 24, weight: .medium, design: .rounded))
                            .foregroundStyle(.tertiary)
                    }
                }
                .contextMenu {
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString("\(fixture.id)", forType: .string)
                    } label: {
                        Label("Copy Fixture ID", systemImage: "doc.on.doc")
                    }
                }

                Button {
                    appState.openTeam(
                        teamId: fixture.awayId,
                        teamName: fixture.awayName,
                        leagueId: fixture.leagueId,
                        leagueName: leagueName,
                        season: fixture.season
                    )
                } label: {
                    VStack(spacing: 8) {
                        teamLogo(url: fixture.awayLogoURL)
                        HStack(spacing: 6) {
                            Text(fixture.awayName)
                                .font(.headline)
                                .multilineTextAlignment(.center)
                            TeamPositionView(position: awayPosition, size: .small)
                        }
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .contextMenu {
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString("\(fixture.awayId)", forType: .string)
                    } label: {
                        Label("Copy Team ID", systemImage: "doc.on.doc")
                    }
                }
            }

            if isInPlay {
                Button {
                    syncFixtureStats()
                } label: {
                    Label("Refresh", systemImage: "arrow.trianglehead.2.clockwise")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
    }

    private func teamLogo(url: URL?) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                ProgressView().frame(width: 48, height: 48)
            case .success(let image):
                image.resizable().aspectRatio(contentMode: .fit).frame(width: 48, height: 48)
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
                ForEach(buildComparisons(stats)) { stat in
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
            Picker("", selection: $tab.formScope) {
                ForEach(FormScope.allCases) { scope in
                    Text(scope.rawValue).tag(scope)
                }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 200)

            if let data = preMatchData {
                formSection(data: data)

                Divider()

                statsSection(data: data)

                if let matchup = matchupData {
                    Divider()
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

    private func formSection(data: PreMatchData) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Form").font(.headline)

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
                if let fixture = fixtureRepository.fixture(id: result.id) {
                    appState.openFixture(fixture)
                }
            }
            .onHover { hovering in
                if hovering { NSCursor.pointingHand.push() } else { NSCursor.pop() }
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
            Text("Stats").font(.headline)

            ForEach(buildSeasonComparisons(home: data.home.seasonStats, away: data.away.seasonStats)) { stat in
                StatComparisonRow(stat: stat)
            }
        }
    }

    private func buildSeasonComparisons(home: SeasonStats, away: SeasonStats) -> [StatComparison] {
        [
            StatComparison(label: "Possession", homeValue: home.possessionAvg, awayValue: away.possessionAvg, format: .percentage),
            StatComparison(label: "Shots / game", homeValue: home.shotsPerGame, awayValue: away.shotsPerGame, format: .decimal),
            StatComparison(label: "Shots on Target / game", homeValue: home.shotsOnTargetPerGame, awayValue: away.shotsOnTargetPerGame, format: .decimal),
            StatComparison(label: "Corners / game", homeValue: home.cornersPerGame, awayValue: away.cornersPerGame, format: .decimal),
            StatComparison(label: "Goals For", homeValue: Double(home.goalsFor), awayValue: Double(away.goalsFor), format: .integer),
            StatComparison(label: "Goals Against", homeValue: Double(home.goalsAgainst), awayValue: Double(away.goalsAgainst), format: .integer),
            StatComparison(label: "xG For", homeValue: home.xgFor, awayValue: away.xgFor, format: .decimal),
            StatComparison(label: "xG Against", homeValue: home.xgAgainst, awayValue: away.xgAgainst, format: .decimal),
            StatComparison(label: "Clean Sheets", homeValue: Double(home.cleanSheets), awayValue: Double(away.cleanSheets), format: .integer),
        ]
    }

    private func matchupSection(data: MatchupData) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Attack vs Defense").font(.headline)

            HStack(alignment: .top, spacing: 24) {
                matchupColumn(
                    title: "\(data.home.teamName) ATK",
                    subtitle: "vs \(data.away.teamName) DEF",
                    attackStats: data.home.forStats,
                    defenseStats: data.away.againstStats
                )

                Divider()

                matchupColumn(
                    title: "\(data.away.teamName) ATK",
                    subtitle: "vs \(data.home.teamName) DEF",
                    attackStats: data.away.forStats,
                    defenseStats: data.home.againstStats
                )
            }
        }
    }

    private func matchupColumn(title: String, subtitle: String, attackStats: MatchupStats, defenseStats: MatchupStats) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline).fontWeight(.semibold)
            Text(subtitle).font(.caption).foregroundStyle(.secondary)

            MatchupBar(label: "Shots", attackValue: attackStats.shotsPerGame, defenseValue: defenseStats.shotsPerGame)
            MatchupBar(label: "SoT", attackValue: attackStats.shotsOnTargetPerGame, defenseValue: defenseStats.shotsOnTargetPerGame)
            MatchupBar(label: "xG", attackValue: attackStats.xgPerGame, defenseValue: defenseStats.xgPerGame)
            MatchupBar(label: "Corners", attackValue: attackStats.cornersPerGame, defenseValue: defenseStats.cornersPerGame)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func timeOnly(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    private func dateOnly(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
