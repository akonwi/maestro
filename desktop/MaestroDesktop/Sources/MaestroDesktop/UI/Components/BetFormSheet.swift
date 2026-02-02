import SwiftUI

struct BetFormSheet: View {
    @Environment(\.dismiss) private var dismiss

    let fixture: FixtureSummary
    let marketId: Int
    let marketName: String
    let lineName: String
    let initialOdds: Int
    let lineValue: Double?
    let onSave: (Bet) -> Void
    let onCancel: () -> Void

    @State private var odds: String
    @State private var stake: Double = 10
    @State private var notes: String = ""

    init(
        fixture: FixtureSummary,
        marketId: Int,
        marketName: String,
        lineName: String,
        initialOdds: Int,
        lineValue: Double?,
        onSave: @escaping (Bet) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.fixture = fixture
        self.marketId = marketId
        self.marketName = marketName
        self.lineName = lineName
        self.initialOdds = initialOdds
        self.lineValue = lineValue
        self.onSave = onSave
        self.onCancel = onCancel
        self._odds = State(initialValue: initialOdds > 0 ? "+\(initialOdds)" : "\(initialOdds)")
    }

    private var parsedOdds: Int? {
        Int(odds.replacingOccurrences(of: "+", with: ""))
    }

    private var parsedStake: Double? {
        stake > 0 ? stake : nil
    }

    private var potentialPayout: Double? {
        guard let odds = parsedOdds, let stake = parsedStake, stake > 0 else { return nil }
        if odds > 0 {
            return stake + (stake * Double(odds) / 100.0)
        } else {
            return stake + (stake * 100.0 / Double(abs(odds)))
        }
    }

    private var potentialProfit: Double? {
        guard let payout = potentialPayout, let stake = parsedStake else { return nil }
        return payout - stake
    }

    private var isValid: Bool {
        parsedOdds != nil && parsedStake != nil && (parsedStake ?? 0) > 0
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Record Bet")
                        .font(.headline)
                    Text("\(fixture.homeName) vs \(fixture.awayName)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(action: onCancel) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                        .font(.title2)
                }
                .buttonStyle(.plain)
            }
            .padding()
            .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            // Form
            VStack(alignment: .leading, spacing: 16) {
                // Market & Selection (read-only)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Selection")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("\(marketName): \(lineName)")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }

                // Odds (editable)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Odds")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("Odds", text: $odds)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 100)
                }

                // Stake + Payout preview
                HStack(alignment: .top, spacing: 24) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Stake")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack {
                            Text(String(format: "$%.0f", stake))
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .frame(width: 50, alignment: .leading)
                            Stepper("", value: $stake, in: 5...1000, step: 5)
                                .labelsHidden()
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Profit")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let profit = potentialProfit {
                            Text(String(format: "$%.2f", profit))
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundStyle(.green)
                        } else {
                            Text("—")
                                .font(.subheadline)
                                .foregroundStyle(.tertiary)
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Payout")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let payout = potentialPayout {
                            Text(String(format: "$%.2f", payout))
                                .font(.subheadline)
                                .fontWeight(.medium)
                        } else {
                            Text("—")
                                .font(.subheadline)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }

                // Notes
                VStack(alignment: .leading, spacing: 4) {
                    Text("Notes (optional)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextEditor(text: $notes)
                        .font(.body)
                        .frame(height: 80)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                        )
                }
            }
            .padding()

            Divider()

            // Actions
            HStack {
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)

                Spacer()

                Button("Save") {
                    saveBet()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!isValid)
            }
            .padding()
        }
        .frame(width: 400)
    }

    private func debugLog(_ msg: String) {
        let path = NSHomeDirectory() + "/maestro_debug.log"
        let line = "[\(Date())] \(msg)\n"
        if let data = line.data(using: .utf8) {
            if FileManager.default.fileExists(atPath: path) {
                if let handle = FileHandle(forWritingAtPath: path) {
                    handle.seekToEndOfFile()
                    handle.write(data)
                    handle.closeFile()
                }
            } else {
                FileManager.default.createFile(atPath: path, contents: data)
            }
        }
    }

    private func saveBet() {
        guard let odds = parsedOdds, stake > 0 else {
            debugLog("Invalid odds or stake: odds=\(self.odds), stake=\(self.stake)")
            return
        }

        debugLog("Saving bet: fixture=\(fixture.id), market=\(marketId), odds=\(odds), stake=\(stake)")
        if let bet = BetRepository.shared.create(
            fixtureId: fixture.id,
            marketId: marketId,
            line: lineValue,
            odds: odds,
            stake: stake,
            notes: notes.isEmpty ? nil : notes
        ) {
            debugLog("Bet saved successfully: \(bet.id)")
            onSave(bet)
            dismiss()
        } else {
            debugLog("Failed to save bet")
        }
    }
}
