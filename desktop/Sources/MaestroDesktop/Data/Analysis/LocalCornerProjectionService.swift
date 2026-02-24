import Foundation

struct LocalCornerProjectionService {
    static let modelVersion = "corner-local-v1.0"

    private struct ModelParams {
        let attackWeight: Double
        let defenseWeight: Double
        let venueWeight: Double
        let recentWeight: Double
        let paceShotsWeight: Double
        let paceShotQualityWeight: Double
        let paceTempoQualityWeight: Double
        let paceXGWeight: Double
        let pacePossessionWeight: Double
    }

    private let defaultParams = ModelParams(
        attackWeight: 0.50,
        defenseWeight: 0.50,
        venueWeight: 0.20,
        recentWeight: 0.28,
        paceShotsWeight: 0.0,
        paceShotQualityWeight: 0.0,
        paceTempoQualityWeight: 0.0,
        paceXGWeight: 0.0,
        pacePossessionWeight: 1.0
    )

    private let leagueOverrides: [Int: ModelParams] = [
        // English Championship
        40: ModelParams(
            attackWeight: 0.50,
            defenseWeight: 0.50,
            venueWeight: 0.60,
            recentWeight: 0.06,
            paceShotsWeight: 0.0,
            paceShotQualityWeight: 0.0,
            paceTempoQualityWeight: 0.0,
            paceXGWeight: 0.0,
            pacePossessionWeight: 1.0
        )
    ]

    func projectCorners(payload: CornerAnalysisPayload) -> CornerAnalysisResponse {
        let params = parameters(for: payload.fixture.leagueId)

        let homeAttack = blendedAttackStrength(team: payload.homeTeam, params: params)
        let awayAttack = blendedAttackStrength(team: payload.awayTeam, params: params)
        let homeDefenseLeak = blendedDefenseLeak(team: payload.homeTeam, params: params)
        let awayDefenseLeak = blendedDefenseLeak(team: payload.awayTeam, params: params)

        var expectedHome = params.attackWeight * homeAttack + params.defenseWeight * awayDefenseLeak
        var expectedAway = params.attackWeight * awayAttack + params.defenseWeight * homeDefenseLeak

        let paceFactor = paceAdjustment(home: payload.homeTeam, away: payload.awayTeam, params: params)
        expectedHome *= paceFactor
        expectedAway *= paceFactor

        expectedHome = clamp(expectedHome, min: 1.5, max: 9.5)
        expectedAway = clamp(expectedAway, min: 1.0, max: 8.5)

        let total = expectedHome + expectedAway
        let homeConfidence = teamProjectionConfidence(team: payload.homeTeam)
        let awayConfidence = teamProjectionConfidence(team: payload.awayTeam)
        let confidence = clamp((homeConfidence + awayConfidence) / 2, min: 0.52, max: 0.82)

        let summary = String(
            format: "Local model projects %.1f total corners (%.1f home, %.1f away). Confidence %.0f%%.",
            total,
            expectedHome,
            expectedAway,
            confidence * 100
        )

        let factors = [
            "Direct attack-vs-defense matchup projection",
            "Venue-adjusted corner trends",
            "Recent five-match corner form with shrinkage",
            "Pace adjustment from possession (shot/tempo/xG ready)",
            "Model version \(Self.modelVersion)",
        ]

        return CornerAnalysisResponse(
            analysis: .init(
                expectedTotalCorners: total,
                expectedHomeCorners: expectedHome,
                expectedAwayCorners: expectedAway,
                totalConfidence: confidence,
                homeConfidence: homeConfidence,
                awayConfidence: awayConfidence,
                method: "Deterministic Poisson-style baseline (performance-only)",
                keyFactors: factors
            ),
            picks: [],
            pass: ["Odds and market edge analysis disabled in performance-only mode."],
            recommendation: "PASS",
            summary: summary
        )
    }

    private func parameters(for leagueId: Int) -> ModelParams {
        leagueOverrides[leagueId] ?? defaultParams
    }

    private func blendedAttackStrength(team: CornerAnalysisPayload.TeamAnalysisData, params: ModelParams) -> Double {
        let seasonWeight = normalizedWeight(sampleSize: team.seasonGames, cap: 24)
        let venueSampleWeight = normalizedWeight(sampleSize: team.venueGames, cap: 14)
        let appliedRecentWeight = team.recentForm.isEmpty ? 0.0 : params.recentWeight

        let seasonValue = max(team.seasonCornersFor, 0.0)
        let venueValue = max(team.venueCornersFor, 0.0)
        let recentValue = mean(team.recentForm.map { Double($0.cornersWon) }) ?? seasonValue

        let seasonalBlend = weightedMean(
            values: [seasonValue, venueValue],
            weights: [max(0.2, seasonWeight), max(0.1, params.venueWeight * venueSampleWeight)]
        ) ?? seasonValue

        return weightedMean(
            values: [seasonalBlend, recentValue],
            weights: [max(0.65, 1.0 - appliedRecentWeight), appliedRecentWeight]
        ) ?? seasonalBlend
    }

    private func blendedDefenseLeak(team: CornerAnalysisPayload.TeamAnalysisData, params: ModelParams) -> Double {
        let seasonWeight = normalizedWeight(sampleSize: team.seasonGames, cap: 24)
        let venueSampleWeight = normalizedWeight(sampleSize: team.venueGames, cap: 14)
        let recentConceded = mean(team.recentForm.map { Double($0.cornersConceded) }) ?? team.seasonCornersAgainst

        let seasonalLeak = weightedMean(
            values: [max(team.seasonCornersAgainst, 0.0), max(team.venueCornersAgainst, 0.0)],
            weights: [max(0.2, seasonWeight), max(0.1, params.venueWeight * venueSampleWeight)]
        ) ?? max(team.seasonCornersAgainst, 0.0)

        return weightedMean(
            values: [seasonalLeak, recentConceded],
            weights: [max(0.65, 1.0 - params.recentWeight), params.recentWeight]
        ) ?? seasonalLeak
    }

    private func paceAdjustment(home: CornerAnalysisPayload.TeamAnalysisData, away: CornerAnalysisPayload.TeamAnalysisData, params: ModelParams) -> Double {
        let shotsBaseline = 12.0
        let shotsOnGoalRateBaseline = 0.32
        let shotsInBoxShareBaseline = 0.55
        let passesBaseline = 420.0
        let passCompletionBaseline = 0.78
        let xGBaseline = 1.2
        let possessionBaseline = 0.5

        let avgShots = (home.shotsPerGame + away.shotsPerGame) / 2
        let avgShotsOnGoalPerGame = (home.shotsOnGoalPerGame + away.shotsOnGoalPerGame) / 2
        let avgShotsInBoxShare = (home.shotsInBoxShare + away.shotsInBoxShare) / 2
        let avgPassesPerGame = (home.passesPerGame + away.passesPerGame) / 2
        let avgPassCompletionRate = (home.passCompletionRate + away.passCompletionRate) / 2
        let avgXG = (home.xgPerGame + away.xgPerGame) / 2
        let avgPossession = (home.possessionAvg + away.possessionAvg) / 2

        let shotsFactor = clamp(avgShots / shotsBaseline, min: 0.9, max: 1.12)
        let shotsOnGoalRate = avgShots > 0 ? avgShotsOnGoalPerGame / avgShots : shotsOnGoalRateBaseline
        let shotQualityFactor = clamp(
            (0.5 * (shotsOnGoalRate / shotsOnGoalRateBaseline)) +
                (0.5 * (avgShotsInBoxShare / shotsInBoxShareBaseline)),
            min: 0.9,
            max: 1.12
        )
        let tempoQualityFactor = clamp(
            (0.5 * (avgPassesPerGame / passesBaseline)) +
                (0.5 * (avgPassCompletionRate / passCompletionBaseline)),
            min: 0.9,
            max: 1.12
        )
        let xGFactor = clamp(avgXG / xGBaseline, min: 0.9, max: 1.12)
        let possessionFactor = clamp(avgPossession / possessionBaseline, min: 0.95, max: 1.05)

        let totalWeight = params.paceShotsWeight + params.paceShotQualityWeight + params.paceTempoQualityWeight + params.paceXGWeight + params.pacePossessionWeight
        let shotsComponent = totalWeight > 0 ? params.paceShotsWeight / totalWeight : 0.0
        let shotQualityComponent = totalWeight > 0 ? params.paceShotQualityWeight / totalWeight : 0.0
        let tempoQualityComponent = totalWeight > 0 ? params.paceTempoQualityWeight / totalWeight : 0.0
        let xGComponent = totalWeight > 0 ? params.paceXGWeight / totalWeight : 0.0
        let possessionComponent = totalWeight > 0 ? params.pacePossessionWeight / totalWeight : 1.0

        return clamp(
            (shotsFactor * shotsComponent) +
                (shotQualityFactor * shotQualityComponent) +
                (tempoQualityFactor * tempoQualityComponent) +
                (xGFactor * xGComponent) +
                (possessionFactor * possessionComponent),
            min: 0.9,
            max: 1.12
        )
    }

    private func teamProjectionConfidence(team: CornerAnalysisPayload.TeamAnalysisData) -> Double {
        let seasonDepth = min(Double(team.seasonGames) / 24.0, 1.0)
        let venueDepth = min(Double(team.venueGames) / 14.0, 1.0)
        let variance = sampleStandardDeviation(team.recentForm.map { Double($0.cornersWon + $0.cornersConceded) })
        let stability = 1.0 - min(variance / 5.0, 1.0)

        let score = (seasonDepth * 0.5) + (venueDepth * 0.3) + (stability * 0.2)
        return clamp(0.52 + (score * 0.3), min: 0.52, max: 0.82)
    }

    private func weightedMean(values: [Double], weights: [Double]) -> Double? {
        guard values.count == weights.count, !values.isEmpty else { return nil }
        let totalWeight = weights.reduce(0, +)
        guard totalWeight > 0 else { return nil }

        var weightedTotal = 0.0
        for index in values.indices {
            weightedTotal += values[index] * weights[index]
        }
        return weightedTotal / totalWeight
    }

    private func mean(_ values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        return values.reduce(0, +) / Double(values.count)
    }

    private func sampleStandardDeviation(_ values: [Double]) -> Double {
        guard values.count > 1 else { return 0 }
        let avg = values.reduce(0, +) / Double(values.count)
        let variance = values
            .map { ($0 - avg) * ($0 - avg) }
            .reduce(0, +) / Double(values.count - 1)
        return sqrt(variance)
    }

    private func normalizedWeight(sampleSize: Int, cap: Int) -> Double {
        guard cap > 0 else { return 0 }
        return min(Double(sampleSize) / Double(cap), 1.0)
    }

    private func clamp(_ value: Double, min minValue: Double, max maxValue: Double) -> Double {
        Swift.max(minValue, Swift.min(maxValue, value))
    }
}
