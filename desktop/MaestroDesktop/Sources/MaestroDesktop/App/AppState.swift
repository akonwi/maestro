import Foundation
import Combine

@MainActor
final class AppState: ObservableObject {
    @Published var selectedDate: Date = Date()
    @Published var openFixtures: [FixtureTab] = []
    @Published var activeTabId: UUID?
    @Published var leagueSections: [LeagueSection] = []
    @Published var didAutoSelectDate = false
    @Published var apiToken: String = ""
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
        refreshLeagues()
        refreshBets()

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

    func closeTab(_ tabId: UUID) {
        guard let index = openFixtures.firstIndex(where: { $0.id == tabId }) else {
            return
        }

        openFixtures.remove(at: index)
        if activeTabId == tabId {
            activeTabId = openFixtures.last?.id
        }
    }

    func refreshFixtures() {
        let sections = fixtureRepository.fixturesGroupedByLeague(for: selectedDate)
        leagueSections = sections
        print("Loaded \(sections.count) league sections for \(selectedDate)")

        if sections.isEmpty && !didAutoSelectDate {
            if let latestDate = fixtureRepository.latestFixtureDate() {
                didAutoSelectDate = true
                selectedDate = latestDate
                print("Auto-selected latest fixture date: \(latestDate)")
                leagueSections = fixtureRepository.fixturesGroupedByLeague(for: latestDate)
            }
        }
    }

    func updateApiToken(_ token: String) {
        apiToken = token
        settingsRepository.setApiToken(token)
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
}
