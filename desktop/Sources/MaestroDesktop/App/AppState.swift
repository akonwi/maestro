import Foundation
import Combine
import SwiftUI
import AppKit
import SQLite3

@MainActor
final class AppState: ObservableObject {
    @Published var selectedDate: Date = Date()
    @Published var openFixtures: [FixtureTab] = []
    @Published var openLeagues: [LeagueTab] = []
    @Published var openTeams: [TeamTab] = []
    @Published var activeTabId: UUID?
    @Published var leagueSections: [LeagueSection] = []
    @Published var didAutoSelectDate = false
    @Published var apiToken: String = ""
    @Published var openAIKey: String = ""
    @Published var bankroll: Double = 0
    @Published var followedLeagues: [FollowedLeague] = []
    @Published var toast: Toast?
    @Published var betStats: BetStats = .empty
    @Published var pendingBets: [Bet] = []

    let syncService = SyncService()

    private let fixtureRepository = FixtureRepository()
    private let settingsRepository = SettingsRepository()
    private let leagueRepository = LeagueRepository()
    private var cancellables = Set<AnyCancellable>()
    private var settleTimer: Timer?
    private var fixtureRefreshTimer: Timer?

    init() {
        apiToken = settingsRepository.getApiToken()
        openAIKey = settingsRepository.getOpenAIKey()
        bankroll = settingsRepository.getBankroll()
        refreshLeagues()
        refreshBets()
        restoreSession()
        setupSessionPersistence()
        startSettleTimer()
        startFixtureRefreshTimer()

        syncService.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    private func startSettleTimer() {
        trySettlePendingBets()

        // Check every 5 minutes
        settleTimer = Timer.scheduledTimer(withTimeInterval: 5 * 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.trySettlePendingBets()
            }
        }
    }

    private func startFixtureRefreshTimer() {
        // Sync all followed leagues every 30 minutes to keep fixture list current
        fixtureRefreshTimer = Timer.scheduledTimer(withTimeInterval: 30 * 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.apiToken.isEmpty else { return }
                await self.syncService.syncAllLeagues(apiKey: self.apiToken)
                self.refreshFixtures()
            }
        }
    }

    private func trySettlePendingBets() {
        // Always check the database directly, don't rely on cached pendingBets
        let settledCount = BetRepository.shared.trySettlePendingBets()
        if settledCount > 0 {
            refreshBets()
            toast = .success("Auto-settled \(settledCount) bet\(settledCount == 1 ? "" : "s")")
        }
    }

    func openFixture(_ fixture: FixtureSummary) {
        if let existing = openFixtures.first(where: { $0.fixture.id == fixture.id }) {
            activeTabId = existing.id
            return
        }

        let tab = FixtureTab(fixture: fixture)
        openFixtures.append(tab)
        activeTabId = tab.id
    }

    func openLeague(_ league: FollowedLeague) {
        if let existing = openLeagues.first(where: { $0.league.id == league.id }) {
            activeTabId = existing.id
            return
        }

        let tab = LeagueTab(league: league)
        openLeagues.append(tab)
        activeTabId = tab.id
    }

    func openTeam(teamId: Int, teamName: String, leagueId: Int, leagueName: String, season: Int) {
        // Check if we already have this team open for this season
        if let existingIndex = openTeams.firstIndex(where: { $0.teamId == teamId && $0.season == season }) {
            let existingTab = openTeams[existingIndex]
            
            // If the requested league is different from current selection, switch to it
            if existingTab.selectedCompetition != .specific(leagueId: leagueId) {
                openTeams[existingIndex].selectedCompetition = .specific(leagueId: leagueId)
            }
            
            activeTabId = existingTab.id
            return
        }

        // Create new team tab and load available leagues
        let teamRepository = TeamRepository()
        let availableLeagues = teamRepository.teamLeagues(teamId: teamId, season: season)
        
        // Default to aggregate view, but if only one league available, show that specific one
        let initialCompetition: TeamTab.TeamCompetitionFilter = availableLeagues.count == 1 ? 
            .specific(leagueId: leagueId) : .all
        
        var tab = TeamTab(teamId: teamId, teamName: teamName, season: season, initialCompetition: initialCompetition)
        tab.availableLeagues = availableLeagues
        
        openTeams.append(tab)
        activeTabId = tab.id
    }

    func closeTab(_ tabId: UUID) {
        if let index = openFixtures.firstIndex(where: { $0.id == tabId }) {
            openFixtures.remove(at: index)
            if activeTabId == tabId {
                activeTabId = openFixtures.last?.id ?? openLeagues.last?.id ?? openTeams.last?.id
            }
            return
        }

        if let index = openLeagues.firstIndex(where: { $0.id == tabId }) {
            openLeagues.remove(at: index)
            if activeTabId == tabId {
                activeTabId = openLeagues.last?.id ?? openFixtures.last?.id ?? openTeams.last?.id
            }
            return
        }

        if let index = openTeams.firstIndex(where: { $0.id == tabId }) {
            openTeams.remove(at: index)
            if activeTabId == tabId {
                activeTabId = openTeams.last?.id ?? openFixtures.last?.id ?? openLeagues.last?.id
            }
            return
        }
    }

    func refreshFixtures() {
        let sections = fixtureRepository.fixturesGroupedByLeague(for: selectedDate)
        leagueSections = sections
        print("Loaded \(sections.count) league sections for \(selectedDate)")

        if sections.isEmpty && !didAutoSelectDate {
            if let latestDate = fixtureRepository.latestFixtureDate() {
                selectedDate = latestDate
                print("Auto-selected latest fixture date: \(latestDate)")
                leagueSections = fixtureRepository.fixturesGroupedByLeague(for: latestDate)
            }
        }
        didAutoSelectDate = true
    }

    func updateApiToken(_ token: String) {
        apiToken = token
        settingsRepository.setApiToken(token)
    }

    func updateOpenAIKey(_ key: String) {
        openAIKey = key
        settingsRepository.setOpenAIKey(key)
    }

    func updateBankroll(_ amount: Double) {
        bankroll = amount
        settingsRepository.setBankroll(amount)
    }

    func refreshLeagues() {
        followedLeagues = leagueRepository.followedLeagues()
    }

    func refreshBets() {
        betStats = BetRepository.shared.stats()
        pendingBets = BetRepository.shared.pendingBets()
    }

    func followAndSync(league: LeagueSearchResult) {
        leagueRepository.follow(league: league)
        refreshLeagues()

        Task {
            let result = await syncService.importLeague(id: league.id, apiKey: apiToken)
            refreshFixtures()
            showSyncToast(result)
        }
    }

    func syncLeague(id: Int) {
        Task {
            let result = await syncService.syncLeague(id: id, apiKey: apiToken)
            refreshFixtures()
            showSyncToast(result)
        }
    }

    func syncAllLeagues() {
        guard syncService.syncingLeagues.isEmpty else { return }
        Task {
            await syncService.syncAllLeagues(apiKey: apiToken)
            refreshFixtures()
        }
    }

    func syncFixture(_ fixture: FixtureSummary) {
        Task {
            let success = await syncService.syncFixture(
                id: fixture.id,
                leagueId: fixture.leagueId,
                season: fixture.season,
                apiKey: apiToken
            )
            if success {
                refreshFixtures()
                toast = .success("Fixture synced")
            } else {
                toast = .error("Failed to sync fixture")
            }
        }
    }

    func refreshActiveContext() {
        guard !apiToken.isEmpty else {
            refreshFixtures()
            toast = .error("API token required for sync")
            return
        }

        if let tabId = activeTabId {
            if let fixtureTab = openFixtures.first(where: { $0.id == tabId }) {
                syncFixture(fixtureTab.fixture)
                return
            }

            if let leagueTab = openLeagues.first(where: { $0.id == tabId }) {
                syncLeague(id: leagueTab.league.id)
                return
            }

            if let teamTab = openTeams.first(where: { $0.id == tabId }) {
                // For aggregate view, sync all leagues the team is in
                if teamTab.selectedCompetition.isAll {
                    for league in teamTab.availableLeagues {
                        syncLeague(id: league.id)
                    }
                } else if let leagueId = teamTab.selectedCompetition.leagueId {
                    syncLeague(id: leagueId)
                }
                return
            }
        }

        syncAllLeagues()
    }

    func closeActiveTab() {
        guard let tabId = activeTabId else { return }
        closeTab(tabId)
    }

    private func showSyncToast(_ result: SyncResult) {
        if let error = result.error {
            toast = .error("Sync failed: \(error)")
        } else {
            toast = .success("\(result.leagueName): \(result.fixtureCount) fixtures synced")
        }
    }

    func unfollowLeague(id: Int) {
        leagueRepository.unfollow(leagueId: id)
        refreshLeagues()
    }

    func isSyncing(leagueId: Int) -> Bool {
        syncService.syncingLeagues.contains(leagueId)
    }

    var isSyncingAnyLeagues: Bool {
        !syncService.syncingLeagues.isEmpty
    }

    // MARK: - Session Persistence

    func setupSessionPersistence() {
        NotificationCenter.default.addObserver(
            forName: NSApplication.willTerminateNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            MainActor.assumeIsolated {
                self.saveSession()
            }
        }
    }

    func saveSession() {
        let fixtureTabs = openFixtures.map { tab in
            PersistedFixtureTab(
                fixtureId: tab.fixture.id,
                activeTab: tab.activeTab?.rawValue,
                formScope: tab.formScope.rawValue
            )
        }

        let leagueTabs = openLeagues.map { tab in
            PersistedLeagueTab(leagueId: tab.league.id)
        }

        let teamTabs = openTeams.map { tab in
            PersistedTeamTab(
                teamId: tab.teamId,
                leagueId: tab.selectedCompetition.leagueId ?? 0, // 0 for aggregate view
                season: tab.season,
                activeTab: tab.activeTab.rawValue,
                statsScope: tab.statsScope.rawValue
            )
        }

        let activeUri = activeTabIdentifier()?.uri

        let state = SessionState(
            fixtureTabs: fixtureTabs,
            leagueTabs: leagueTabs,
            teamTabs: teamTabs,
            activeTabUri: activeUri
        )

        SessionPersistence.shared.save(state)
    }

    func restoreSession() {
        guard let state = SessionPersistence.shared.load() else { return }

        // Restore fixture tabs
        for persisted in state.fixtureTabs {
            if let fixture = fixtureRepository.fixture(id: persisted.fixtureId) {
                var tab = FixtureTab(fixture: fixture)
                if let activeTabRaw = persisted.activeTab,
                   let activeTab = FixtureTab.FixtureTabView(rawValue: activeTabRaw) {
                    tab.activeTab = activeTab
                }
                if let formScope = FormScope(rawValue: persisted.formScope) {
                    tab.formScope = formScope
                }
                openFixtures.append(tab)
            }
        }

        // Restore league tabs
        for persisted in state.leagueTabs {
            if let league = followedLeagues.first(where: { $0.id == persisted.leagueId }) {
                let tab = LeagueTab(league: league)
                openLeagues.append(tab)
            }
        }

        // Restore team tabs
        for persisted in state.teamTabs {
            if let teamName = teamName(for: persisted.teamId) {
                let teamRepository = TeamRepository()
                let availableLeagues = teamRepository.teamLeagues(teamId: persisted.teamId, season: persisted.season)
                
                // Restore competition filter: if leagueId is 0, use aggregate view
                let restoredCompetition: TeamTab.TeamCompetitionFilter = 
                    persisted.leagueId == 0 ? .all : .specific(leagueId: persisted.leagueId)
                
                var tab = TeamTab(
                    teamId: persisted.teamId,
                    teamName: teamName,
                    season: persisted.season,
                    initialCompetition: restoredCompetition
                )
                tab.availableLeagues = availableLeagues
                if let activeTab = TeamTab.TeamTabView(rawValue: persisted.activeTab) {
                    tab.activeTab = activeTab
                }
                if let statsScope = TeamTab.TeamStatsScope(rawValue: persisted.statsScope) {
                    tab.statsScope = statsScope
                }
                openTeams.append(tab)
            }
        }

        // Restore active tab
        if let activeUri = state.activeTabUri,
           let identifier = TabIdentifier.from(uri: activeUri) {
            switch identifier {
            case .fixture(let id):
                activeTabId = openFixtures.first { $0.fixture.id == id }?.id
            case .league(let id):
                activeTabId = openLeagues.first { $0.league.id == id }?.id
            case .team(let teamId, let leagueId, _):
                let competitionFilter: TeamTab.TeamCompetitionFilter = leagueId == 0 ? .all : .specific(leagueId: leagueId)
                activeTabId = openTeams.first { $0.teamId == teamId && $0.selectedCompetition == competitionFilter }?.id
            }
        }
    }

    private func activeTabIdentifier() -> TabIdentifier? {
        guard let tabId = activeTabId else { return nil }

        if let tab = openFixtures.first(where: { $0.id == tabId }) {
            return .fixture(id: tab.fixture.id)
        }
        if let tab = openLeagues.first(where: { $0.id == tabId }) {
            return .league(id: tab.league.id)
        }
        if let tab = openTeams.first(where: { $0.id == tabId }) {
            return .team(teamId: tab.teamId, leagueId: tab.selectedCompetition.leagueId ?? 0, season: tab.season)
        }
        return nil
    }

    private func teamName(for teamId: Int) -> String? {
        // Query database for team name
        guard let db = Database.shared.handle else { return nil }
        let sql = "SELECT name FROM teams WHERE id = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        sqlite3_bind_int64(statement, 1, Int64(teamId))

        var name: String?
        if sqlite3_step(statement) == SQLITE_ROW {
            name = String(cString: sqlite3_column_text(statement, 0))
        }

        sqlite3_finalize(statement)
        return name
    }

    // MARK: - Tab State Bindings

    func fixtureTabBinding(_ tabId: UUID) -> Binding<FixtureTab>? {
        guard openFixtures.contains(where: { $0.id == tabId }) else { return nil }
        return Binding(
            get: { 
                guard let index = self.openFixtures.firstIndex(where: { $0.id == tabId }),
                      index < self.openFixtures.count else {
                    // Return a default tab if the binding becomes invalid
                    return FixtureTab(fixture: FixtureSummary(
                        id: 0, leagueId: 0, season: 2025, homeId: 0, awayId: 0,
                        homeName: "Unknown", awayName: "Unknown", status: "NS",
                        kickoff: Date(), homeGoals: 0, awayGoals: 0
                    ))
                }
                return self.openFixtures[index]
            },
            set: { newValue in
                guard let index = self.openFixtures.firstIndex(where: { $0.id == tabId }),
                      index < self.openFixtures.count else { return }
                self.openFixtures[index] = newValue
            }
        )
    }

    func leagueTabBinding(_ tabId: UUID) -> Binding<LeagueTab>? {
        guard openLeagues.contains(where: { $0.id == tabId }) else { return nil }
        return Binding(
            get: { 
                guard let index = self.openLeagues.firstIndex(where: { $0.id == tabId }),
                      index < self.openLeagues.count else {
                    // Return a default tab if the binding becomes invalid
                    return LeagueTab(league: FollowedLeague(id: 0, name: "Unknown", currentSeason: 2025))
                }
                return self.openLeagues[index]
            },
            set: { newValue in
                guard let index = self.openLeagues.firstIndex(where: { $0.id == tabId }),
                      index < self.openLeagues.count else { return }
                self.openLeagues[index] = newValue
            }
        )
    }

    func teamTabBinding(_ tabId: UUID) -> Binding<TeamTab>? {
        guard openTeams.contains(where: { $0.id == tabId }) else { return nil }
        return Binding(
            get: { 
                guard let index = self.openTeams.firstIndex(where: { $0.id == tabId }),
                      index < self.openTeams.count else {
                    // Return a default tab if the binding becomes invalid
                    return TeamTab(teamId: 0, teamName: "Unknown", season: 2025)
                }
                return self.openTeams[index]
            },
            set: { newValue in
                guard let index = self.openTeams.firstIndex(where: { $0.id == tabId }),
                      index < self.openTeams.count else { return }
                self.openTeams[index] = newValue
            }
        )
    }
}
