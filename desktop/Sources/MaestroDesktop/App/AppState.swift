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
    @Published var followedLeagues: [FollowedLeague] = []
    @Published var toast: Toast?
    @Published var betStats: BetStats = .empty
    @Published var pendingBets: [Bet] = []

    let syncService = SyncService()

    private let fixtureRepository = FixtureRepository()
    private let settingsRepository = SettingsRepository()
    private let leagueRepository = LeagueRepository()
    private var cancellables = Set<AnyCancellable>()

    init() {
        apiToken = settingsRepository.getApiToken()
        openAIKey = settingsRepository.getOpenAIKey()
        refreshLeagues()
        refreshBets()
        restoreSession()
        setupSessionPersistence()

        syncService.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
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
        if let existing = openTeams.first(where: { $0.teamId == teamId && $0.leagueId == leagueId }) {
            activeTabId = existing.id
            return
        }

        let tab = TeamTab(teamId: teamId, teamName: teamName, leagueId: leagueId, leagueName: leagueName, season: season)
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
                leagueId: tab.leagueId,
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
            if let teamName = teamName(for: persisted.teamId),
               let leagueName = followedLeagues.first(where: { $0.id == persisted.leagueId })?.name {
                var tab = TeamTab(
                    teamId: persisted.teamId,
                    teamName: teamName,
                    leagueId: persisted.leagueId,
                    leagueName: leagueName,
                    season: persisted.season
                )
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
                activeTabId = openTeams.first { $0.teamId == teamId && $0.leagueId == leagueId }?.id
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
            return .team(teamId: tab.teamId, leagueId: tab.leagueId, season: tab.season)
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
        guard let index = openFixtures.firstIndex(where: { $0.id == tabId }) else { return nil }
        return Binding(
            get: { self.openFixtures[index] },
            set: { self.openFixtures[index] = $0 }
        )
    }

    func leagueTabBinding(_ tabId: UUID) -> Binding<LeagueTab>? {
        guard let index = openLeagues.firstIndex(where: { $0.id == tabId }) else { return nil }
        return Binding(
            get: { self.openLeagues[index] },
            set: { self.openLeagues[index] = $0 }
        )
    }

    func teamTabBinding(_ tabId: UUID) -> Binding<TeamTab>? {
        guard let index = openTeams.firstIndex(where: { $0.id == tabId }) else { return nil }
        return Binding(
            get: { self.openTeams[index] },
            set: { self.openTeams[index] = $0 }
        )
    }
}
