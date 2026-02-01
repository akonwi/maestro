import SwiftUI

struct LeagueSearchView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: [LeagueSearchResult] = []
    @State private var isSearching = false
    @State private var errorMessage: String?
    @State private var followedIds: Set<Int> = []

    private let leagueRepository = LeagueRepository()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
            searchField
            Divider()
            resultsList
        }
        .frame(width: 500, height: 450)
        .onAppear {
            loadFollowedIds()
        }
    }

    private var header: some View {
        HStack {
            Text("Find Leagues")
                .font(.headline)
            Spacer()
            Button("Done") {
                dismiss()
            }
            .keyboardShortcut(.cancelAction)
        }
        .padding()
    }

    private var searchField: some View {
        HStack {
            TextField("Search leagues...", text: $query)
                .textFieldStyle(.roundedBorder)
                .onSubmit {
                    Task { await search() }
                }

            Button("Search") {
                Task { await search() }
            }
            .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty || isSearching)
        }
        .padding()
    }

    private var resultsList: some View {
        Group {
            if isSearching {
                ProgressView("Searching...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text(error)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if results.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("Search for leagues to follow")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(results) { result in
                    LeagueSearchRow(
                        result: result,
                        isFollowed: followedIds.contains(result.id),
                        onFollow: { follow(result) },
                        onUnfollow: { unfollow(result.id) }
                    )
                }
            }
        }
    }

    private func search() async {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        isSearching = true
        errorMessage = nil

        let client = APIFootballClient(apiKey: appState.apiToken)

        do {
            results = try await client.searchLeagues(query: trimmed)
        } catch {
            errorMessage = error.localizedDescription
            results = []
        }

        isSearching = false
    }

    private func loadFollowedIds() {
        let leagues = leagueRepository.followedLeagues()
        followedIds = Set(leagues.map(\.id))
    }

    private func follow(_ result: LeagueSearchResult) {
        followedIds.insert(result.id)
        appState.followAndSync(league: result)
    }

    private func unfollow(_ leagueId: Int) {
        leagueRepository.unfollow(leagueId: leagueId)
        followedIds.remove(leagueId)
        appState.refreshLeagues()
    }
}

struct LeagueSearchRow: View {
    let result: LeagueSearchResult
    let isFollowed: Bool
    let onFollow: () -> Void
    let onUnfollow: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(result.league.name)
                    .fontWeight(.medium)
                Text("\(result.country.name) · \(result.league.type.capitalized)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if isFollowed {
                Button("Unfollow") {
                    onUnfollow()
                }
                .buttonStyle(.bordered)
            } else {
                Button("Follow") {
                    onFollow()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(.vertical, 4)
    }
}
