import Foundation

struct FixtureStats: Equatable {
    let home: TeamStats
    let away: TeamStats
}

struct TeamStats: Equatable {
    let teamId: Int
    let shots: Int
    let shotsOnGoal: Int
    let possession: Double
    let passes: Int
    let passesCompleted: Int
    let fouls: Int
    let corners: Int
    let offsides: Int
    let yellowCards: Int
    let redCards: Int
    let xg: Double
}

struct StatComparison: Identifiable {
    let id = UUID()
    let label: String
    let homeValue: Double
    let awayValue: Double
    let format: StatFormat

    enum StatFormat {
        case integer
        case percentage
        case decimal
    }

    var homeDisplay: String {
        formatValue(homeValue)
    }

    var awayDisplay: String {
        formatValue(awayValue)
    }

    var homeRatio: Double {
        let total = homeValue + awayValue
        guard total > 0 else { return 0.5 }
        return homeValue / total
    }

    var awayRatio: Double {
        1 - homeRatio
    }

    private func formatValue(_ value: Double) -> String {
        switch format {
        case .integer:
            return "\(Int(value))"
        case .percentage:
            return "\(Int(value * 100))%"
        case .decimal:
            return String(format: "%.2f", value)
        }
    }
}
