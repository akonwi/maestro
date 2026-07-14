import SwiftUI

struct LeagueDetailView: View {
    @Binding var tab: LeagueTab

    @EnvironmentObject private var appState: AppState
    @State private var sortOrder = [KeyPathComparator(\StandingRow.position)]

    private let leagueRepository = LeagueRepository()

    private var league: FollowedLeague { tab.league }

    var body: some View {
        let standings = leagueRepository.standings(leagueId: league.id, season: league.currentSeason)
        let sortedStandings = standings.sorted(using: sortOrder)

        VStack(alignment: .leading, spacing: 0) {
            header

            if standings.isEmpty {
                ContentUnavailableView(
                    "No Standings",
                    systemImage: "tablecells",
                    description: Text("No finished fixtures yet for the \(league.currentSeason) season.")
                )
            } else {
                standingsTable(sortedStandings)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(league.name)
                .font(.title)
                .fontWeight(.semibold)
            Text("\(String(league.currentSeason))/\(String(league.currentSeason + 1)) Season")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    private func standingsTable(_ standings: [StandingRow]) -> some View {
        Table(standings, sortOrder: $sortOrder) {
            TableColumn("#", value: \.position) { row in
                Text("\(row.position)")
                    .monospacedDigit()
            }
            .width(min: 30, ideal: 40, max: 50)

            TableColumn("Team", value: \.teamName) { row in
                Button {
                    appState.openTeam(
                        teamId: row.teamId,
                        teamName: row.teamName,
                        leagueId: league.id,
                        leagueName: league.name,
                        season: league.currentSeason
                    )
                } label: {
                    Text(row.teamName)
                        .foregroundStyle(.primary)
                }
                .buttonStyle(.plain)
            }
            .width(min: 120, ideal: 200)

            TableColumn("P", value: \.played) { row in
                Text("\(row.played)")
                    .monospacedDigit()
            }
            .width(min: 30, ideal: 40, max: 50)

            TableColumn("W", value: \.won) { row in
                Text("\(row.won)")
                    .monospacedDigit()
            }
            .width(min: 30, ideal: 40, max: 50)

            TableColumn("D", value: \.drawn) { row in
                Text("\(row.drawn)")
                    .monospacedDigit()
            }
            .width(min: 30, ideal: 40, max: 50)

            TableColumn("L", value: \.lost) { row in
                Text("\(row.lost)")
                    .monospacedDigit()
            }
            .width(min: 30, ideal: 40, max: 50)

            TableColumn("GF", value: \.goalsFor) { row in
                Text("\(row.goalsFor)")
                    .monospacedDigit()
            }
            .width(min: 30, ideal: 40, max: 50)

            TableColumn("GA", value: \.goalsAgainst) { row in
                Text("\(row.goalsAgainst)")
                    .monospacedDigit()
            }
            .width(min: 30, ideal: 40, max: 50)

            TableColumn("GD", value: \.goalDifference) { row in
                Text(row.goalDifference >= 0 ? "+\(row.goalDifference)" : "\(row.goalDifference)")
                    .monospacedDigit()
                    .foregroundStyle(row.goalDifference > 0 ? .green : (row.goalDifference < 0 ? .red : .primary))
            }
            .width(min: 40, ideal: 50, max: 60)

            TableColumn("Pts", value: \.points) { row in
                Text("\(row.points)")
                    .monospacedDigit()
                    .fontWeight(.semibold)
            }
            .width(min: 40, ideal: 50, max: 60)
        }
    }
}
