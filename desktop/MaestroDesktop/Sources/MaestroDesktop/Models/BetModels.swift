import Foundation

enum BetResult: String, Codable, CaseIterable {
    case pending
    case won
    case lost
    case push
}

struct Bet: Identifiable, Equatable {
    let id: Int
    let fixtureId: Int
    let marketId: Int
    let line: Double?
    let odds: Int
    let stake: Double
    var result: BetResult
    let notes: String?
    let createdAt: Date

    // Market ID constants (matching API-Football)
    static let marketCornersTotal = 45
    static let marketCornersMoneyline = 55
    static let marketCornersAsian = 56
    static let marketCornersHome = 57
    static let marketCornersAway = 58
    static let marketCornersTotal3Way = 85

    static func marketName(for id: Int) -> String {
        switch id {
        case marketCornersTotal: return "Total Corners"
        case marketCornersMoneyline: return "Most Corners"
        case marketCornersAsian: return "Asian Corners"
        case marketCornersHome: return "Home Corners"
        case marketCornersAway: return "Away Corners"
        case marketCornersTotal3Way: return "Total Corners (3-Way)"
        default: return "Unknown Market"
        }
    }

    var marketName: String {
        Self.marketName(for: marketId)
    }

    var displayDescription: String {
        if let line = line {
            let direction = odds > 0 ? "Over" : "Under"
            return "\(marketName) \(direction) \(String(format: "%.1f", line))"
        }
        return marketName
    }

    var formattedOdds: String {
        if odds > 0 {
            return "+\(odds)"
        }
        return "\(odds)"
    }

    var potentialPayout: Double {
        if odds > 0 {
            return stake + (stake * Double(odds) / 100.0)
        } else {
            return stake + (stake * 100.0 / Double(abs(odds)))
        }
    }

    var potentialProfit: Double {
        potentialPayout - stake
    }
}

struct BetStats: Equatable {
    let totalBets: Int
    let pendingBets: Int
    let wins: Int
    let losses: Int
    let pushes: Int
    let totalStaked: Double
    let totalPayout: Double

    var netProfit: Double {
        totalPayout - totalStaked
    }

    var winRate: Double {
        let resolved = wins + losses
        guard resolved > 0 else { return 0 }
        return Double(wins) / Double(resolved)
    }

    var roi: Double {
        guard totalStaked > 0 else { return 0 }
        return netProfit / totalStaked
    }

    static let empty = BetStats(
        totalBets: 0,
        pendingBets: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        totalStaked: 0,
        totalPayout: 0
    )
}
