import SwiftUI

struct MainScreen: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.colorScheme) private var colorScheme
    @State private var showingSettings = false
    @State private var showingLeagueSearch = false
    @State private var showingDatePicker = false
    @State private var showingChat = false
    @State private var chatFocusRequest = UUID()
    @StateObject private var chatViewModel = ChatViewModel()

    var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            VStack(spacing: 0) {
                if !appState.openFixtures.isEmpty || !appState.openLeagues.isEmpty || !appState.openTeams.isEmpty {
                    tabBar
                    Divider()
                }

                detailContent
            }
        }
        .onAppear {
            // Defer to avoid reentrant NSTableView operations
            DispatchQueue.main.async {
                appState.refreshFixtures()
            }
            chatViewModel.configure(apiKey: appState.openAIKey)
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
        .toast($appState.toast)
        .overlay(alignment: .bottomTrailing) {
            ZStack(alignment: .bottomTrailing) {
                if showingChat {
                    ChatPanelView(viewModel: chatViewModel, focusRequestID: chatFocusRequest)
                        .padding(.trailing, 16)
                        .padding(.bottom, 64)
                        .transition(.scale(scale: 0.8, anchor: .bottomTrailing).combined(with: .opacity))
                }

                ChatFloatingButton(isChatOpen: $showingChat)
                    .padding(16)
            }
        }
        .onChange(of: appState.openAIKey) {
            chatViewModel.configure(apiKey: appState.openAIKey)
        }
        .onReceive(NotificationCenter.default.publisher(for: .maestroOpenSettings)) { _ in
            showingSettings = true
        }
        .onReceive(NotificationCenter.default.publisher(for: .maestroOpenChat)) { _ in
            if showingChat {
                showingChat = false
            } else {
                showingChat = true
                chatFocusRequest = UUID()
            }
        }
    }

    private var sidebar: some View {
        List {
            Section {
                ForEach(appState.followedLeagues) { league in
                    Button {
                        appState.openLeague(league)
                    } label: {
                        HStack(spacing: 8) {
                            leagueLogo(id: league.id, size: 20)
                            Text(league.name)
                            Spacer()
                            if appState.isSyncing(leagueId: league.id) {
                                ProgressView()
                                    .scaleEffect(0.6)
                                    .frame(width: 16, height: 16)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button {
                            appState.syncLeague(id: league.id)
                        } label: {
                            Label("Sync", systemImage: "arrow.trianglehead.2.clockwise")
                        }

                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString("\(league.id)", forType: .string)
                        } label: {
                            Label("Copy League ID", systemImage: "doc.on.doc")
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
                    if appState.isSyncingAnyLeagues {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Spacer()
                    Button {
                        showingLeagueSearch = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .buttonStyle(.plain)
                    .help("Add league")
                }
                .contextMenu {
                    Button {
                        appState.syncAllLeagues()
                    } label: {
                        Label("Sync", systemImage: "arrow.trianglehead.2.clockwise")
                    }
                    .disabled(appState.isSyncingAnyLeagues)
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
                    let isLive = !tab.fixture.isFinished && !tab.fixture.isPostponed && tab.fixture.kickoff <= Date()
                    HStack(spacing: 6) {
                        Button {
                            appState.activeTabId = tab.id
                        } label: {
                            HStack(spacing: 6) {
                                if isLive {
                                    Circle()
                                        .fill(.green)
                                        .frame(width: 8, height: 8)
                                }
                                Text("\(tab.fixture.homeName) v \(tab.fixture.awayName)")
                                    .lineLimit(1)
                            }
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
                    .contextMenu {
                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString("\(tab.fixture.id)", forType: .string)
                        } label: {
                            Label("Copy Fixture ID", systemImage: "doc.on.doc")
                        }
                    }
                }

                ForEach(appState.openLeagues) { tab in
                    HStack(spacing: 6) {
                        Button {
                            appState.activeTabId = tab.id
                        } label: {
                            HStack(spacing: 6) {
                                leagueLogo(id: tab.league.id, size: 16)
                                Text(tab.league.name)
                                    .lineLimit(1)
                            }
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
                    .contextMenu {
                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString("\(tab.league.id)", forType: .string)
                        } label: {
                            Label("Copy League ID", systemImage: "doc.on.doc")
                        }
                    }
                }

                ForEach(appState.openTeams) { tab in
                    HStack(spacing: 6) {
                        Button {
                            appState.activeTabId = tab.id
                        } label: {
                            HStack(spacing: 6) {
                                AsyncImage(url: URL(string: "https://media.api-sports.io/football/teams/\(tab.teamId).png")) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image.resizable().aspectRatio(contentMode: .fit)
                                    default:
                                        Image(systemName: "person.3").font(.caption)
                                    }
                                }
                                .frame(width: 16, height: 16)

                                Text(tab.teamName)
                                    .lineLimit(1)
                            }
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
                    .contextMenu {
                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString("\(tab.teamId)", forType: .string)
                        } label: {
                            Label("Copy Team ID", systemImage: "doc.on.doc")
                        }
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private var detailContent: some View {
        if appState.activeTabId == nil {
            fixtureList
        } else if let fixtureTabBinding = appState.fixtureTabBinding(appState.activeTabId!) {
            FixtureDetailView(tab: fixtureTabBinding)
                .navigationTitle("")
        } else if let leagueTabBinding = appState.leagueTabBinding(appState.activeTabId!) {
            LeagueDetailView(tab: leagueTabBinding)
                .navigationTitle("")
        } else if let teamTabBinding = appState.teamTabBinding(appState.activeTabId!) {
            TeamDetailView(tab: teamTabBinding)
                .navigationTitle("")
        } else {
            Text("No content selected")
                .foregroundStyle(.secondary)
        }
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
                ForEach(appState.leagueSections) { section in
                    Section {
                        ForEach(section.fixtures) { fixture in
                            Button(action: { appState.openFixture(fixture) }) {
                                fixtureRow(fixture)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                if !fixture.isFinished {
                                    Button {
                                        appState.syncFixture(fixture)
                                    } label: {
                                        Label("Sync", systemImage: "arrow.trianglehead.2.clockwise")
                                    }
                                }

                                Button {
                                    NSPasteboard.general.clearContents()
                                    NSPasteboard.general.setString("\(fixture.id)", forType: .string)
                                } label: {
                                    Label("Copy Fixture ID", systemImage: "doc.on.doc")
                                }
                            }
                        }
                    } header: {
                        Button {
                            if let league = appState.followedLeagues.first(where: { $0.id == section.id }) {
                                appState.openLeague(league)
                            }
                        } label: {
                            Text(section.name)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button {
                                appState.syncLeague(id: section.id)
                            } label: {
                                Label("Sync", systemImage: "arrow.trianglehead.2.clockwise")
                            }
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

    private func fixtureRow(_ fixture: FixtureSummary) -> some View {
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
        
        return HStack(spacing: 12) {
            Text(timeOnly(fixture.kickoff))
                .frame(width: 48, alignment: .leading)
                .foregroundStyle(.secondary)
            
            HStack(spacing: 4) {
                HStack(spacing: 4) {
                    if let pos = homePosition {
                        TeamPositionView(position: pos, size: .small)
                    }
                    Text(fixture.homeName)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                
                Text("—")
                    .foregroundStyle(.tertiary)
                
                HStack(spacing: 4) {
                    Text(fixture.awayName)
                    if let pos = awayPosition {
                        TeamPositionView(position: pos, size: .small)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .lineLimit(1)
            
            Spacer()
            
            Text(statusLabel(fixture))
                .foregroundStyle(.secondary)
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

    private func leagueLogo(id: Int, size: CGFloat) -> some View {
        AsyncImage(url: URL(string: "https://media.api-sports.io/football/leagues/\(id).png")) { phase in
            switch phase {
            case .success(let image):
                image.resizable().aspectRatio(contentMode: .fit)
            default:
                Image(systemName: "trophy")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .background(
            colorScheme == .dark
                ? Circle().fill(Color.white)
                : nil
        )
        .clipShape(Circle())
    }
}
