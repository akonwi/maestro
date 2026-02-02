import SwiftUI

struct MatchupBar: View {
    let label: String
    let attackValue: Double
    let defenseValue: Double

    private var total: Double {
        attackValue + defenseValue
    }

    private var attackPercent: Double {
        total > 0 ? attackValue / total : 0.5
    }

    private var defensePercent: Double {
        total > 0 ? defenseValue / total : 0.5
    }

    private var attackWins: Bool {
        attackValue > defenseValue
    }

    private func formatValue(_ value: Double) -> String {
        if value == floor(value) {
            return String(format: "%.0f", value)
        }
        return String(format: "%.1f", value)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("ATK")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(label)
                    .font(.caption)
                    .fontWeight(.medium)
                Spacer()
                Text("DEF")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            GeometryReader { geometry in
                HStack(spacing: 1) {
                    // Attack bar
                    HStack {
                        Text(formatValue(attackValue))
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundStyle(attackWins ? .white : .primary)
                            .padding(.leading, 4)
                        Spacer()
                    }
                    .frame(width: max(geometry.size.width * attackPercent - 0.5, 0))
                    .frame(height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 3)
                            .fill(attackWins ? Color.accentColor : Color(nsColor: .controlBackgroundColor))
                    )

                    // Defense bar
                    HStack {
                        Spacer()
                        Text(formatValue(defenseValue))
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundStyle(!attackWins ? .white : .primary)
                            .padding(.trailing, 4)
                    }
                    .frame(width: max(geometry.size.width * defensePercent - 0.5, 0))
                    .frame(height: 20)
                    .background(
                        RoundedRectangle(cornerRadius: 3)
                            .fill(!attackWins ? Color.orange : Color(nsColor: .controlBackgroundColor))
                    )
                }
            }
            .frame(height: 20)
        }
    }
}
