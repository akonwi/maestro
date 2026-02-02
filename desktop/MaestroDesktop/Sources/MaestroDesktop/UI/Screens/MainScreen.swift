import SwiftUI

struct MainScreen: View {
    @EnvironmentObject private var appState: AppState
    @State private var showingSettings = false
    @State private var showingLeagueSearch = false
    @State private var showingDatePicker = false
    @State private var showingBets = false

    var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            VStack(spacing: 0) {
                if !appState.openFixtures.isEmpty {
                    tabBar
                    Divider()
                }

                if appState.activeTabId == nil {
                    fixtureList
                } else {
                    fixtureDetailContent
                }
            }
        }
        .onAppear {
            appState.refreshLeagues()
            appState.refreshFixtures()
        }
        .onChange(of: appState.selectedDate) {
            appState.refreshFixtures()
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView()
                .environmentObject(appState)
        }
        .sheet(isPresented: $showingLeagueSearch) {
            LeagueSearchView()
                .environmentObject(appState)
        }
        .sheet(isPresented: $showingBets) {
            BetsListView()
                .environmentObject(appState)
        }
        .toast($appState.toast)
    }

    private var sidebar: some View {
        List {
            Section {
                Button {
                    showingBets = true
                } label: {
                    HStack {
                        Label("Bets", systemImage: "dollarsign.circle")
                        Spacer()
                        if appState.betStats.pendingBets > 0 {
                            Text("\(appState.betStats.pendingBets)")
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.2))
                                .cornerRadius(4)
                        }
                    }
                }
                .buttonStyle(.plain)
            }

            Section {
                ForEach(appState.followedLeagues) { league in
                    HStack {
                        Text(league.name)
                        Spacer()
                        if appState.isSyncing(leagueId: league.id) {
                            ProgressView()
                                .scaleEffect(0.6)
                                .frame(width: 16, height: 16)
                        }
                    }
                    .contextMenu {
                        Button {
                            appState.syncLeague(id: league.id)
                        } label: {
                            Label("Sync", systemImage: "arrow.trianglehead.2.clockwise")
                        }

                        Divider()

                        Button(role: .destructive) {
                            appState.unfollowLeague(id: league.id)
                        } label: {
                            Label("Unfollow", systemImage: "trash")
                        }
                    }
                }
            } header: {
                HStack {
                    Text("Leagues")
                    Spacer()
                    Button {
                        showingLeagueSearch = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .buttonStyle(.plain)
                    .help("Add league")
                }
            }
        }
        .listStyle(.sidebar)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gear")
                }
            }
        }
    }

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                // Fixtures list tab (home)
                Button {
                    appState.activeTabId = nil
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "list.bullet")
                        Text("Fixtures")
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(appState.activeTabId == nil ? Color.accentColor.opacity(0.2) : Color.clear)
                    .cornerRadius(6)
                }
                .buttonStyle(.plain)

                ForEach(appState.openFixtures) { tab in
                    HStack(spacing: 6) {
                        Button {
                            appState.activeTabId = tab.id
                        } label: {
                            Text("\(tab.fixture.homeName) v \(tab.fixture.awayName)")
                                .lineLimit(1)
                        }
                        .buttonStyle(.plain)

                        Button {
                            appState.closeTab(tab.id)
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(appState.activeTabId == tab.id ? Color.accentColor.opacity(0.2) : Color.clear)
                    .cornerRadius(6)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
        }
    }

    private var fixtureDetailContent: some View {
        Group {
            if let tab = appState.openFixtures.first(where: { $0.id == appState.activeTabId }) {
                FixtureDetailView(fixture: tab.fixture)
            } else {
                Text("No fixture selected")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("")
    }

    private var fixtureList: some View {
        List {
            if appState.leagueSections.isEmpty {
                ContentUnavailableView(
                    "No Fixtures",
                    systemImage: "calendar",
                    description: Text("No fixtures for \(formattedDate(appState.selectedDate)).")
                )
            } else {
                ForEach(appState.leagueSections) { league in
                    Section(league.name) {
                        ForEach(league.fixtures) { fixture in
                            Button(action: { appState.openFixture(fixture) }) {
                                HStack {
                                    Text(timeOnly(fixture.kickoff))
                                        .frame(width: 48, alignment: .leading)
                                    Text("\(fixture.homeName) — \(fixture.awayName)")
                                        .lineLimit(1)
                                    Spacer()
                                    Text(statusLabel(fixture))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .navigationTitle(formattedDate(appState.selectedDate))
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                Button {
                    appState.selectedDate = Calendar.current.date(byAdding: .day, value: -1, to: appState.selectedDate) ?? appState.selectedDate
                } label: {
                    Image(systemName: "chevron.left")
                }
                .help("Previous day")

                Button {
                    appState.selectedDate = Calendar.current.startOfDay(for: Date())
                } label: {
                    Text("Today")
                }
                .help("Go to today")

                Button {
                    appState.selectedDate = Calendar.current.date(byAdding: .day, value: 1, to: appState.selectedDate) ?? appState.selectedDate
                } label: {
                    Image(systemName: "chevron.right")
                }
                .help("Next day")

                Button {
                    showingDatePicker.toggle()
                } label: {
                    Image(systemName: "calendar")
                }
                .help("Pick a date")
                .popover(isPresented: $showingDatePicker) {
                    DatePicker(
                        "Date",
                        selection: $appState.selectedDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                    .labelsHidden()
                    .padding()
                }
            }
        }
    }

    private func timeOnly(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private func statusLabel(_ fixture: FixtureSummary) -> String {
        if fixture.isFinished {
            return "FT \(fixture.homeGoals) - \(fixture.awayGoals)"
        }
        if fixture.status == "NS" { return "" }
        return fixture.status
    }
}
