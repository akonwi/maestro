import SwiftUI

struct TeamDetailView: View {
    @Binding var tab: TeamTab

    @EnvironmentObject private var appState: AppState

    private let teamRepository = TeamRepository()

    var body: some View {
        let details = teamRepository.teamDetails(
            teamId: tab.teamId,
            leagueId: tab.leagueId,
            leagueName: tab.leagueName,
            season: tab.season
        )

        VStack(spacing: 0) {
            if let details = details {
                header(details)
                    .padding()
                    .background(Color(nsColor: .controlBackgroundColor))

                Divider()

                Picker("", selection: $tab.activeTab) {
                    ForEach(TeamTab.TeamTabView.allCases) { tabView in
                        Text(tabView.rawValue).tag(tabView)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                Divider()

                switch tab.activeTab {
                case .stats:
                    statsContent(details)
                case .fixtures:
                    fixturesContent(details)
                }
            } else {
                ContentUnavailableView(
                    "Team Not Found",
                    systemImage: "person.slash",
                    description: Text("Could not load team details.")
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func header(_ details: TeamDetails) -> some View {
        HStack(spacing: 16) {
            AsyncImage(url: URL(string: "https://media.api-sports.io/football/teams/\(details.teamId).png")) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fit)
                case .failure:
                    Image(systemName: "shield").font(.system(size: 32)).foregroundStyle(.secondary)
                default:
                    ProgressView()
                }
            }
            .frame(width: 64, height: 64)

            VStack(alignment: .leading, spacing: 4) {
                Text(details.teamName)
                    .font(.title)
                    .fontWeight(.semibold)
                Text("\(details.leagueName) \(String(details.season))/\(String(details.season + 1))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if let next = details.nextFixture {
                nextFixtureCard(next, teamId: details.teamId)
            }
        }
    }

    private func nextFixtureCard(_ fixture: FixtureSummary, teamId: Int) -> some View {
        let isHome = fixture.homeId == teamId
        let opponent = isHome ? fixture.awayName : fixture.homeName
        let venue = isHome ? "H" : "A"

        return Button {
            appState.openFixture(fixture)
        } label: {
            VStack(alignment: .trailing, spacing: 4) {
                Text("Next: \(venue) vs \(opponent)")
                    .font(.caption)
                    .fontWeight(.medium)
                Text(formattedDate(fixture.kickoff))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .background(Color(nsColor: .textBackgroundColor))
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Stats Tab

    private func statsContent(_ details: TeamDetails) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Picker("", selection: $tab.statsScope) {
                        ForEach(TeamTab.TeamStatsScope.allCases) { scope in
                            Text(scope.rawValue).tag(scope)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 200)

                    Spacer()
                }

                formBadgesSection(details)
                recordSection(details)
                metricsSection(details)
            }
            .padding()
        }
    }

    private func formBadgesSection(_ details: TeamDetails) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Form")
                .font(.headline)

            if details.form.isEmpty {
                Text("No recent matches")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                HStack(spacing: 6) {
                    ForEach(details.form) { result in
                        formBadge(result)
                    }
                }
            }
        }
    }

    private func formBadge(_ result: TeamFormResult) -> some View {
        let venue = result.isHome ? "H" : "A"
        let tooltip = "\(venue): \(result.goalsFor)-\(result.goalsAgainst) vs \(result.opponent)"

        return Button {
            if let fixture = FixtureRepository().fixture(id: result.id) {
                appState.openFixture(fixture)
            }
        } label: {
            Text(result.result.rawValue)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(badgeColor(for: result.result))
                )
        }
        .buttonStyle(.plain)
        .help(tooltip)
    }

    private func badgeColor(for result: TeamFormResult.MatchResult) -> Color {
        switch result {
        case .win: return .green
        case .draw: return .orange
        case .loss: return .red
        }
    }

    private func recordSection(_ details: TeamDetails) -> some View {
        let record = tab.statsScope == .form ? details.formRecord : details.seasonRecord

        return VStack(alignment: .leading, spacing: 12) {
            Text("Record")
                .font(.headline)

            Grid(alignment: .leading, horizontalSpacing: 24, verticalSpacing: 8) {
                GridRow {
                    Text("").frame(width: 60, alignment: .leading)
                    Text("P").fontWeight(.medium).frame(width: 40)
                    Text("W").fontWeight(.medium).frame(width: 40)
                    Text("D").fontWeight(.medium).frame(width: 40)
                    Text("L").fontWeight(.medium).frame(width: 40)
                    Text("GF").fontWeight(.medium).frame(width: 40)
                    Text("GA").fontWeight(.medium).frame(width: 40)
                    Text("CS").fontWeight(.medium).frame(width: 40)
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                recordRow("Overall", record.overall)
                recordRow("Home", record.home)
                recordRow("Away", record.away)
            }
            .padding()
            .background(Color(nsColor: .controlBackgroundColor))
            .cornerRadius(8)
        }
    }

    @ViewBuilder
    private func recordRow(_ label: String, _ record: TeamRecord) -> some View {
        GridRow {
            Text(label).font(.subheadline).frame(width: 60, alignment: .leading)
            Text("\(record.played)").font(.subheadline).monospacedDigit().frame(width: 40)
            Text("\(record.won)").font(.subheadline).monospacedDigit().foregroundStyle(.green).frame(width: 40)
            Text("\(record.drawn)").font(.subheadline).monospacedDigit().foregroundStyle(.orange).frame(width: 40)
            Text("\(record.lost)").font(.subheadline).monospacedDigit().foregroundStyle(.red).frame(width: 40)
            Text("\(record.goalsFor)").font(.subheadline).monospacedDigit().frame(width: 40)
            Text("\(record.goalsAgainst)").font(.subheadline).monospacedDigit().frame(width: 40)
            Text("\(record.cleanSheets)").font(.subheadline).monospacedDigit().frame(width: 40)
        }
    }

    private func metricsSection(_ details: TeamDetails) -> some View {
        let comparison = tab.statsScope == .form ? details.formMetrics : details.seasonMetrics
        let team = comparison.team
        let opp = comparison.opponents

        return VStack(alignment: .leading, spacing: 16) {
            Text("Metrics")
                .font(.headline)

            HStack(alignment: .top, spacing: 24) {
                // Offensive metrics
                VStack(alignment: .leading, spacing: 12) {
                    Text("Offensive")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    metricComparisonRow("Shots", teamValue: team.shots, oppValue: opp.shots, format: "%.1f")
                    metricComparisonRow("On Target", teamValue: team.shotsOnTarget, oppValue: opp.shotsOnTarget, format: "%.1f")
                    metricComparisonRow("xG", teamValue: team.xg, oppValue: opp.xg, format: "%.2f")
                    metricComparisonRow("Corners", teamValue: team.corners, oppValue: opp.corners, format: "%.1f")
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(8)

                // Defensive/Possession metrics
                VStack(alignment: .leading, spacing: 12) {
                    Text("Possession")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    metricComparisonRow("Possession", teamValue: team.possession * 100, oppValue: opp.possession * 100, format: "%.0f%%", isPercentage: true)
                    metricComparisonRow("Passes", teamValue: team.passes, oppValue: opp.passes, format: "%.0f")
                    metricComparisonRow("Pass Acc", teamValue: team.passAccuracy * 100, oppValue: opp.passAccuracy * 100, format: "%.0f%%", isPercentage: true)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(8)
            }

            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Circle().fill(Color.accentColor).frame(width: 8, height: 8)
                    Text("Team").font(.caption).foregroundStyle(.secondary)
                }
                HStack(spacing: 4) {
                    Circle().fill(Color.gray.opacity(0.5)).frame(width: 8, height: 8)
                    Text("Opponents").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }

    private func metricComparisonRow(_ label: String, teamValue: Double, oppValue: Double, format: String, isPercentage: Bool = false) -> some View {
        let maxValue = max(teamValue, oppValue, 1)
        let teamRatio = teamValue / maxValue
        let oppRatio = oppValue / maxValue

        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(String(format: format, teamValue))
                    .font(.caption)
                    .fontWeight(.medium)
                    .monospacedDigit()
                Text("/")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                Text(String(format: format, oppValue))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            GeometryReader { geo in
                VStack(spacing: 2) {
                    // Team bar
                    HStack(spacing: 0) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.accentColor)
                            .frame(width: geo.size.width * teamRatio)
                        Spacer(minLength: 0)
                    }
                    .frame(height: 4)

                    // Opponent bar
                    HStack(spacing: 0) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.gray.opacity(0.5))
                            .frame(width: geo.size.width * oppRatio)
                        Spacer(minLength: 0)
                    }
                    .frame(height: 4)
                }
            }
            .frame(height: 10)
        }
    }

    // MARK: - Fixtures Tab

    private func fixturesContent(_ details: TeamDetails) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(details.allFixtures) { fixture in
                    fixtureRow(fixture)
                }
            }
            .padding()
        }
    }

    private func fixtureRow(_ fixture: TeamFixtureResult) -> some View {
        Button {
            if let f = FixtureRepository().fixture(id: fixture.id) {
                appState.openFixture(f)
            }
        } label: {
            HStack {
                Text(formattedShortDate(fixture.date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 60, alignment: .leading)

                Text(fixture.isHome ? "H" : "A")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)

                Text(fixture.opponent)
                    .lineLimit(1)

                Spacer()

                if fixture.isFinished {
                    Text("\(fixture.goalsFor) - \(fixture.goalsAgainst)")
                        .monospacedDigit()
                        .fontWeight(.medium)

                    resultBadge(gf: fixture.goalsFor, ga: fixture.goalsAgainst)
                } else {
                    Text("—")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(Color(nsColor: .controlBackgroundColor))
            .cornerRadius(4)
        }
        .buttonStyle(.plain)
    }

    private func resultBadge(gf: Int, ga: Int) -> some View {
        let result: String
        let color: Color
        if gf > ga {
            result = "W"
            color = .green
        } else if gf < ga {
            result = "L"
            color = .red
        } else {
            result = "D"
            color = .orange
        }

        return Text(result)
            .font(.caption2)
            .fontWeight(.bold)
            .foregroundStyle(.white)
            .frame(width: 20, height: 20)
            .background(RoundedRectangle(cornerRadius: 3).fill(color))
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d 'at' HH:mm"
        return formatter.string(from: date)
    }

    private func formattedShortDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
