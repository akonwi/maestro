import SwiftUI

struct BetsListView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var bets: [Bet] = []
    @State private var filter: BetFilter = .all

    enum BetFilter: String, CaseIterable, Identifiable {
        case all = "All"
        case pending = "Pending"
        case settled = "Settled"

        var id: String { rawValue }
    }

    private let fixtureRepository = FixtureRepository()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Bets")
                    .font(.headline)
                Spacer()
                Picker("", selection: $filter) {
                    ForEach(BetFilter.allCases) { f in
                        Text(f.rawValue).tag(f)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 200)

                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                        .font(.title2)
                }
                .buttonStyle(.plain)
            }
            .padding()
            .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            // Stats summary
            statsBar
                .padding()

            Divider()

            // Bets list
            if filteredBets.isEmpty {
                ContentUnavailableView(
                    "No Bets",
                    systemImage: "dollarsign.circle",
                    description: Text("No bets recorded yet.")
                )
            } else {
                List {
                    ForEach(filteredBets) { bet in
                        betRow(bet)
                    }
                }
            }
        }
        .frame(width: 600, height: 500)
        .onAppear {
            loadBets()
        }
        .onChange(of: filter) {
            loadBets()
        }
    }

    private var filteredBets: [Bet] {
        switch filter {
        case .all:
            return bets
        case .pending:
            return bets.filter { $0.result == .pending }
        case .settled:
            return bets.filter { $0.result != .pending }
        }
    }

    private var statsBar: some View {
        let stats = appState.betStats
        return HStack(spacing: 24) {
            statItem(label: "Pending", value: "\(stats.pendingBets)")
            statItem(label: "Record", value: "\(stats.wins)-\(stats.losses)-\(stats.pushes)")
            statItem(label: "Win Rate", value: String(format: "%.0f%%", stats.winRate * 100))
            statItem(label: "ROI", value: String(format: "%.1f%%", stats.roi * 100), color: stats.roi >= 0 ? .green : .red)
            statItem(label: "Net P/L", value: String(format: "$%.2f", stats.netProfit), color: stats.netProfit >= 0 ? .green : .red)
        }
    }

    private func statItem(label: String, value: String, color: Color = .primary) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(color)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func betRow(_ bet: Bet) -> some View {
        let fixture = fixtureRepository.fixture(id: bet.fixtureId)

        return HStack {
            VStack(alignment: .leading, spacing: 4) {
                if let fixture = fixture {
                    Text("\(fixture.homeName) v \(fixture.awayName)")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                Text(bet.displayDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let notes = bet.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(bet.formattedOdds)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(String(format: "$%.2f", bet.stake))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            resultBadge(bet.result)
                .frame(width: 60)
        }
        .padding(.vertical, 4)
        .contextMenu {
            if bet.result == .pending {
                Button {
                    updateBet(id: bet.id, result: .won)
                } label: {
                    Label("Mark Won", systemImage: "checkmark.circle")
                }

                Button {
                    updateBet(id: bet.id, result: .lost)
                } label: {
                    Label("Mark Lost", systemImage: "xmark.circle")
                }

                Button {
                    updateBet(id: bet.id, result: .push)
                } label: {
                    Label("Mark Push", systemImage: "minus.circle")
                }

                Divider()
            }

            Button(role: .destructive) {
                deleteBet(id: bet.id)
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func resultBadge(_ result: BetResult) -> some View {
        let (text, color): (String, Color) = {
            switch result {
            case .pending: return ("Pending", .secondary)
            case .won: return ("Won", .green)
            case .lost: return ("Lost", .red)
            case .push: return ("Push", .orange)
            }
        }()

        return Text(text)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .cornerRadius(4)
    }

    private func loadBets() {
        bets = BetRepository.shared.allBets()
    }

    private func updateBet(id: Int, result: BetResult) {
        BetRepository.shared.update(id: id, result: result)
        loadBets()
        appState.refreshBets()
    }

    private func deleteBet(id: Int) {
        BetRepository.shared.delete(id: id)
        loadBets()
        appState.refreshBets()
    }
}
