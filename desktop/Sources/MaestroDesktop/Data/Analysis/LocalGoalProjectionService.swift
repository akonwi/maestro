import Foundation

struct LocalGoalProjectionService {
    static let modelVersion = "goal-local-v1.0"

    private struct ModelParams {
        let attackWeight: Double
        let defenseWeight: Double
        let venueWeight: Double
        let recentWeight: Double
        let goalsWeight: Double
        let xgWeight: Double
        let shotVolumeWeight: Double
        let shotQualityWeight: Double
        let possessionWeight: Double
        let finishingWeight: Double
        let homeAdvantageGoals: Double
    }

    private let defaultParams = ModelParams(
        attackWeight: 0.55,
        defenseWeight: 0.45,
        venueWeight: 0.35,
        recentWeight: 0.22,
        goalsWeight: 0.55,
        xgWeight: 0.45,
        shotVolumeWeight: 0.30,
        shotQualityWeight: 0.35,
        possessionWeight: 0.10,
        finishingWeight: 0.25,
        homeAdvantageGoals: 0.18
    )

    private let leagueOverrides: [Int: ModelParams] = [
        40: ModelParams(
            attackWeight: 0.56,
            defenseWeight: 0.44,
            venueWeight: 0.42,
            recentWeight: 0.18,
            goalsWeight: 0.52,
            xgWeight: 0.48,
            shotVolumeWeight: 0.32,
            shotQualityWeight: 0.36,
            possessionWeight: 0.08,
            finishingWeight: 0.24,
            homeAdvantageGoals: 0.16
        )
    ]

    func projectGoals(payload: GoalAnalysisPayload) -> GoalAnalysisResponse {
        let params = parameters(for: payload.fixture.leagueId)

        let homeAttack = blendedAttackStrength(team: payload.homeTeam, params: params)
        let awayAttack = blendedAttackStrength(team: payload.awayTeam, params: params)
        let homeDefenseLeak = blendedDefenseLeak(team: payload.homeTeam, params: params)
        let awayDefenseLeak = blendedDefenseLeak(team: payload.awayTeam, params: params)

        var expectedHome = (params.attackWeight * homeAttack) + (params.defenseWeight * awayDefenseLeak)
        var expectedAway = (params.attackWeight * awayAttack) + (params.defenseWeight * homeDefenseLeak)

        let homeAttackFactor = attackQualityAdjustment(team: payload.homeTeam, params: params)
        let awayAttackFactor = attackQualityAdjustment(team: payload.awayTeam, params: params)
        let awayDefenseFactor = defenseConcessionAdjustment(team: payload.awayTeam)
        let homeDefenseFactor = defenseConcessionAdjustment(team: payload.homeTeam)

        expectedHome *= homeAttackFactor * awayDefenseFactor
        expectedAway *= awayAttackFactor * homeDefenseFactor

        expectedHome += params.homeAdvantageGoals
        expectedAway = max(0.05, expectedAway - (params.homeAdvantageGoals * 0.35))

        expectedHome = clamp(expectedHome, min: 0.20, max: 3.80)
        expectedAway = clamp(expectedAway, min: 0.15, max: 3.40)

        let total = expectedHome + expectedAway
        let over25 = probabilityOver(threshold: 2, lambda: total)
        let btts = (1.0 - exp(-expectedHome)) * (1.0 - exp(-expectedAway))

        let homeConfidence = teamProjectionConfidence(team: payload.homeTeam)
        let awayConfidence = teamProjectionConfidence(team: payload.awayTeam)
        let confidence = clamp((homeConfidence + awayConfidence) / 2.0, min: 0.50, max: 0.80)

        let factors = [
            "Blended season, venue, and recent goal/xG profiles",
            "Attack-vs-defense matchup using goals and xG against",
            "Shot volume and shot quality finishing adjustments",
            "Home advantage adjustment",
            "Model version \(Self.modelVersion)",
        ]

        let probabilityEngine = GoalMarketProbabilityEngine()
        let decisionEngine = GoalOddsDecisionEngine()
        let marketInputs = payload.markets.map { market in
            GoalOddsDecisionEngine.MarketInput(
                marketId: market.id,
                marketName: market.name,
                lines: market.lines.map { GoalOddsDecisionEngine.LineInput(name: $0.name, odds: $0.odds) }
            )
        }

        let projected = GoalOddsDecisionEngine.ProjectionInput(
            expectedHomeGoals: expectedHome,
            expectedAwayGoals: expectedAway,
            expectedTotalGoals: total,
            over2_5Probability: over25,
            bttsProbability: btts,
            homeConfidence: homeConfidence,
            awayConfidence: awayConfidence,
            totalConfidence: confidence
        )

        let decision = decisionEngine.selectBets(
            fixtureId: payload.fixture.id,
            projection: projected,
            markets: marketInputs,
            bankroll: payload.bettingProfile?.bankroll,
            pendingBets: payload.pendingBets ?? [],
            probabilityEngine: probabilityEngine
        )

        return GoalAnalysisResponse(
            analysis: .init(
                expectedTotalGoals: total,
                expectedHomeGoals: expectedHome,
                expectedAwayGoals: expectedAway,
                over2_5Probability: over25,
                bttsProbability: btts,
                totalConfidence: confidence,
                homeConfidence: homeConfidence,
                awayConfidence: awayConfidence,
                method: "Deterministic local goals model",
                keyFactors: factors
            ),
            picks: decision.picks,
            pass: decision.passReasons,
            recommendation: decision.picks.isEmpty ? "PASS" : "BET",
            summary: decision.summary ?? String(format: "Local model projects %.2f total goals (%.2f home, %.2f away).", total, expectedHome, expectedAway)
        )
    }

    private func parameters(for leagueId: Int) -> ModelParams {
        leagueOverrides[leagueId] ?? defaultParams
    }

    private func blendedAttackStrength(team: GoalAnalysisPayload.TeamAnalysisData, params: ModelParams) -> Double {
        let seasonWeight = normalizedWeight(sampleSize: team.seasonGames, cap: 24)
        let venueSampleWeight = normalizedWeight(sampleSize: team.venueGames, cap: 14)
        let appliedRecentWeight = team.recentForm.isEmpty ? 0.0 : params.recentWeight

        let seasonValue = weightedMean(
            values: [max(team.seasonGoalsFor, 0.0), max(team.seasonXGFor, 0.0)],
            weights: [params.goalsWeight, params.xgWeight]
        ) ?? max(team.seasonGoalsFor, 0.0)
        let venueValue = weightedMean(
            values: [max(team.venueGoalsFor, 0.0), max(team.venueXGFor, 0.0)],
            weights: [params.goalsWeight, params.xgWeight]
        ) ?? seasonValue

        let recentGoals = mean(team.recentForm.map { Double($0.goalsFor) }) ?? seasonValue
        let recentXG = mean(team.recentForm.map { $0.xgFor }) ?? seasonValue
        let recentValue = weightedMean(values: [recentGoals, recentXG], weights: [params.goalsWeight, params.xgWeight]) ?? seasonValue

        let seasonalBlend = weightedMean(
            values: [seasonValue, venueValue],
            weights: [max(0.2, seasonWeight), max(0.1, params.venueWeight * venueSampleWeight)]
        ) ?? seasonValue

        return weightedMean(
            values: [seasonalBlend, recentValue],
            weights: [max(0.65, 1.0 - appliedRecentWeight), appliedRecentWeight]
        ) ?? seasonalBlend
    }

    private func blendedDefenseLeak(team: GoalAnalysisPayload.TeamAnalysisData, params: ModelParams) -> Double {
        let seasonWeight = normalizedWeight(sampleSize: team.seasonGames, cap: 24)
        let venueSampleWeight = normalizedWeight(sampleSize: team.venueGames, cap: 14)

        let seasonValue = weightedMean(
            values: [max(team.seasonGoalsAgainst, 0.0), max(team.seasonXGAgainst, 0.0)],
            weights: [params.goalsWeight, params.xgWeight]
        ) ?? max(team.seasonGoalsAgainst, 0.0)
        let venueValue = weightedMean(
            values: [max(team.venueGoalsAgainst, 0.0), max(team.venueXGAgainst, 0.0)],
            weights: [params.goalsWeight, params.xgWeight]
        ) ?? seasonValue

        let recentGA = mean(team.recentForm.map { Double($0.goalsAgainst) }) ?? seasonValue
        let recentXGA = mean(team.recentForm.map { $0.xgAgainst }) ?? seasonValue
        let recentValue = weightedMean(values: [recentGA, recentXGA], weights: [params.goalsWeight, params.xgWeight]) ?? seasonValue

        let seasonalBlend = weightedMean(
            values: [seasonValue, venueValue],
            weights: [max(0.2, seasonWeight), max(0.1, params.venueWeight * venueSampleWeight)]
        ) ?? seasonValue

        return weightedMean(
            values: [seasonalBlend, recentValue],
            weights: [max(0.65, 1.0 - params.recentWeight), params.recentWeight]
        ) ?? seasonalBlend
    }

    private func attackQualityAdjustment(team: GoalAnalysisPayload.TeamAnalysisData, params: ModelParams) -> Double {
        let shotsBaseline = 12.0
        let shotsOnGoalBaseline = 4.1
        let shotsInBoxBaseline = 0.52
        let possessionBaseline = 0.50

        let shotsFactor = clamp(team.shotsPerGame / shotsBaseline, min: 0.88, max: 1.15)
        let shotsOnGoalFactor = clamp(team.shotsOnGoalPerGame / shotsOnGoalBaseline, min: 0.88, max: 1.15)
        let shotQualityFactor = clamp(
            (0.55 * shotsOnGoalFactor) +
                (0.45 * clamp(team.shotsInBoxShare / shotsInBoxBaseline, min: 0.90, max: 1.12)),
            min: 0.88,
            max: 1.14
        )
        let possessionFactor = clamp(team.possessionAvg / possessionBaseline, min: 0.95, max: 1.05)

        let expectedGoalsFloor = max(team.seasonXGFor, 0.25)
        let finishingFactor = clamp(team.seasonGoalsFor / expectedGoalsFloor, min: 0.88, max: 1.12)

        let totalWeight = params.shotVolumeWeight + params.shotQualityWeight + params.possessionWeight + params.finishingWeight
        guard totalWeight > 0 else { return 1.0 }

        return clamp(
            (
                (shotsFactor * params.shotVolumeWeight) +
                (shotQualityFactor * params.shotQualityWeight) +
                (possessionFactor * params.possessionWeight) +
                (finishingFactor * params.finishingWeight)
            ) / totalWeight,
            min: 0.88,
            max: 1.14
        )
    }

    private func defenseConcessionAdjustment(team: GoalAnalysisPayload.TeamAnalysisData) -> Double {
        let xGABaseline = 1.25
        let goalsAgainstBaseline = 1.35

        let xgaFactor = clamp(team.seasonXGAgainst / xGABaseline, min: 0.88, max: 1.14)
        let gaFactor = clamp(team.seasonGoalsAgainst / goalsAgainstBaseline, min: 0.88, max: 1.14)

        return clamp((xgaFactor * 0.6) + (gaFactor * 0.4), min: 0.88, max: 1.14)
    }

    private func teamProjectionConfidence(team: GoalAnalysisPayload.TeamAnalysisData) -> Double {
        let seasonDepth = min(Double(team.seasonGames) / 24.0, 1.0)
        let venueDepth = min(Double(team.venueGames) / 14.0, 1.0)
        let variance = sampleStandardDeviation(team.recentForm.map { Double($0.goalsFor + $0.goalsAgainst) })
        let stability = 1.0 - min(variance / 2.4, 1.0)

        let score = (seasonDepth * 0.5) + (venueDepth * 0.25) + (stability * 0.25)
        return clamp(0.50 + (score * 0.30), min: 0.50, max: 0.80)
    }

    private func probabilityOver(threshold: Int, lambda: Double) -> Double {
        let cumulative = poissonCDF(k: threshold, lambda: lambda)
        return clamp(1.0 - cumulative, min: 0.0, max: 1.0)
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
        let variance = values.map { ($0 - avg) * ($0 - avg) }.reduce(0, +) / Double(values.count - 1)
        return sqrt(variance)
    }

    private func normalizedWeight(sampleSize: Int, cap: Int) -> Double {
        guard cap > 0 else { return 0 }
        return min(Double(sampleSize) / Double(cap), 1.0)
    }

    private func poissonCDF(k: Int, lambda: Double) -> Double {
        if k < 0 { return 0 }
        if lambda <= 0 { return 1 }

        let upper = max(0, k)
        var pmf = exp(-lambda)
        var sum = pmf
        if upper == 0 { return clamp(sum, min: 0, max: 1) }

        for i in 1...upper {
            pmf *= lambda / Double(i)
            sum += pmf
        }
        return clamp(sum, min: 0, max: 1)
    }

    private func clamp(_ value: Double, min minValue: Double, max maxValue: Double) -> Double {
        Swift.max(minValue, Swift.min(maxValue, value))
    }
}

private struct GoalMarketProbabilityEngine {
    enum Side {
        case over
        case under
        case yes
        case no
    }

    struct LineProbability {
        let winProbability: Double
        let pushProbability: Double
    }

    func probability(
        marketId: Int,
        lineName: String,
        expectedHomeGoals: Double,
        expectedAwayGoals: Double,
        expectedTotalGoals: Double,
        bttsProbability: Double,
        over2_5Probability: Double
    ) -> LineProbability? {
        let lower = lineName.lowercased()
        switch marketId {
        case Bet.marketGoalsTotal:
            guard let side = parseOverUnder(lower), let lineValue = extractLineValue(from: lower) else { return nil }
            return probabilityForCount(side: side, lineValue: lineValue, lambda: expectedTotalGoals)
        case Bet.marketGoalsHome:
            guard let side = parseOverUnder(lower), let lineValue = extractLineValue(from: lower) else { return nil }
            return probabilityForCount(side: side, lineValue: lineValue, lambda: expectedHomeGoals)
        case Bet.marketGoalsAway:
            guard let side = parseOverUnder(lower), let lineValue = extractLineValue(from: lower) else { return nil }
            return probabilityForCount(side: side, lineValue: lineValue, lambda: expectedAwayGoals)
        case Bet.marketBothTeamsScore:
            if lower.contains("yes") {
                return .init(winProbability: bttsProbability, pushProbability: 0)
            }
            if lower.contains("no") {
                return .init(winProbability: 1.0 - bttsProbability, pushProbability: 0)
            }
            return nil
        default:
            return nil
        }
    }

    private func probabilityForCount(side: Side, lineValue: Double, lambda: Double) -> LineProbability {
        let integerLine = abs(lineValue - lineValue.rounded()) < 0.0001
        let floorValue = Int(floor(lineValue))

        switch side {
        case .over:
            if integerLine {
                let win = 1.0 - poissonCDF(k: floorValue, lambda: lambda)
                let push = poissonPMF(k: floorValue, lambda: lambda)
                return .init(winProbability: win, pushProbability: push)
            }
            let win = 1.0 - poissonCDF(k: floorValue, lambda: lambda)
            return .init(winProbability: win, pushProbability: 0)
        case .under:
            if integerLine {
                let win = poissonCDF(k: floorValue - 1, lambda: lambda)
                let push = poissonPMF(k: floorValue, lambda: lambda)
                return .init(winProbability: win, pushProbability: push)
            }
            let win = poissonCDF(k: floorValue, lambda: lambda)
            return .init(winProbability: win, pushProbability: 0)
        default:
            return .init(winProbability: 0, pushProbability: 0)
        }
    }

    private func parseOverUnder(_ lineName: String) -> Side? {
        if lineName.hasPrefix("over") { return .over }
        if lineName.hasPrefix("under") { return .under }
        return nil
    }

    private func extractLineValue(from lineName: String) -> Double? {
        let parts = lineName.split(separator: " ")
        guard let tail = parts.last else { return nil }
        return Double(tail)
    }

    private func poissonCDF(k: Int, lambda: Double) -> Double {
        if k < 0 { return 0 }
        if lambda <= 0 { return 1 }

        let upper = max(0, k)
        var pmf = exp(-lambda)
        var sum = pmf
        if upper == 0 { return min(max(sum, 0), 1) }

        for i in 1...upper {
            pmf *= lambda / Double(i)
            sum += pmf
        }
        return min(max(sum, 0), 1)
    }

    private func poissonPMF(k: Int, lambda: Double) -> Double {
        if k < 0 { return 0 }
        if lambda <= 0 { return k == 0 ? 1 : 0 }
        if k == 0 { return exp(-lambda) }

        var pmf = exp(-lambda)
        for i in 1...k {
            pmf *= lambda / Double(i)
        }
        return pmf
    }
}

private struct GoalOddsDecisionEngine {
    struct LineInput {
        let name: String
        let odds: Int
    }

    struct MarketInput {
        let marketId: Int
        let marketName: String
        let lines: [LineInput]
    }

    struct ProjectionInput {
        let expectedHomeGoals: Double
        let expectedAwayGoals: Double
        let expectedTotalGoals: Double
        let over2_5Probability: Double
        let bttsProbability: Double
        let homeConfidence: Double
        let awayConfidence: Double
        let totalConfidence: Double
    }

    struct DecisionResult {
        let picks: [GoalAnalysisResponse.Pick]
        let passReasons: [String]
        let summary: String?
    }

    private struct CandidatePick {
        let pick: GoalAnalysisResponse.Pick
        let groupKey: String
        let descriptor: String
    }

    private let minConfidence = 0.64
    private let minEdgePoints = 5.0
    private let minEVPct = 4.0
    private let shortestAllowedFavoriteOdds = -210
    private let longestAllowedUnderdogOdds = 400
    private let minEstimatedProbability = 0.25
    private let maxPicksPerFixture = 2
    private let maxFixtureExposurePct = 0.03
    private let secondPickMinConfidence = 0.70
    private let secondPickMinEdgePoints = 8.0
    private let highCorrelationThreshold = 0.65
    private let secondPickMaxCorrelation = 0.35
    private let pendingExposureTightenPct = 0.10

    func selectBets(
        fixtureId: Int,
        projection: ProjectionInput,
        markets: [MarketInput],
        bankroll: Double?,
        pendingBets: [GoalAnalysisPayload.PendingBet],
        probabilityEngine: GoalMarketProbabilityEngine
    ) -> DecisionResult {
        var candidates: [CandidatePick] = []
        var passReasons: [String] = []
        let totalPendingStake = pendingBets.reduce(0) { $0 + $1.stake }
        let pendingExposurePct = (bankroll ?? 0) > 0 ? totalPendingStake / (bankroll ?? 1) : 0.0
        let effectiveMinConfidence = minConfidence + (pendingExposurePct >= pendingExposureTightenPct ? 0.02 : 0.0)
        let effectiveMinEdgePoints = minEdgePoints + (pendingExposurePct >= pendingExposureTightenPct ? 1.0 : 0.0)
        let effectiveMinEVPct = minEVPct + (pendingExposurePct >= pendingExposureTightenPct ? 1.0 : 0.0)
        let pendingFixtureBets = pendingBets.filter { $0.fixtureId == fixtureId }
        let pendingGroups = Set(pendingFixtureBets.map { correlationGroupKey(marketId: $0.marketId) })

        if markets.isEmpty {
            return .init(picks: [], passReasons: ["No supported goal markets available for this fixture."], summary: nil)
        }

        for market in markets {
            for line in market.lines {
                guard let probability = probabilityEngine.probability(
                    marketId: market.marketId,
                    lineName: line.name,
                    expectedHomeGoals: projection.expectedHomeGoals,
                    expectedAwayGoals: projection.expectedAwayGoals,
                    expectedTotalGoals: projection.expectedTotalGoals,
                    bttsProbability: projection.bttsProbability,
                    over2_5Probability: projection.over2_5Probability
                ) else {
                    passReasons.append("\(market.marketName) \(line.name): unsupported line format.")
                    continue
                }

                let implied = impliedProbability(fromAmericanOdds: line.odds)
                let edge = (probability.winProbability - implied) * 100.0
                let confidence = confidenceForLine(marketId: market.marketId, projection: projection)
                let decimalOdds = decimalOdds(fromAmericanOdds: line.odds)
                let loseProbability = max(0, 1.0 - probability.winProbability - probability.pushProbability)
                let evPerUnit = (probability.winProbability * (decimalOdds - 1.0)) - loseProbability
                let evPct = evPerUnit * 100.0

                if line.odds < shortestAllowedFavoriteOdds {
                    passReasons.append("\(market.marketName) \(line.name): odds \(line.odds) too short for target return.")
                    continue
                }
                if line.odds > longestAllowedUnderdogOdds {
                    passReasons.append("\(market.marketName) \(line.name): odds +\(line.odds) too long — Poisson tail estimates unreliable.")
                    continue
                }
                guard probability.winProbability >= minEstimatedProbability else {
                    passReasons.append("\(market.marketName) \(line.name): model probability \(Int(probability.winProbability * 100))% too low for reliable estimation.")
                    continue
                }
                guard confidence >= effectiveMinConfidence else {
                    passReasons.append("\(market.marketName) \(line.name): confidence \(Int(confidence * 100))% below threshold.")
                    continue
                }
                let scaledMinEdge = scaledEdgeThreshold(odds: line.odds, baseEdge: effectiveMinEdgePoints)
                guard edge >= scaledMinEdge else {
                    passReasons.append("\(market.marketName) \(line.name): edge \(String(format: "%.1f", edge))pp below threshold (\(String(format: "%.1f", scaledMinEdge))pp required at these odds).")
                    continue
                }
                guard evPct >= effectiveMinEVPct else {
                    passReasons.append("\(market.marketName) \(line.name): EV \(String(format: "%.1f", evPct))% below threshold.")
                    continue
                }

                let stake = recommendedStake(
                    bankroll: bankroll,
                    decimalOdds: decimalOdds,
                    winProbability: probability.winProbability,
                    confidence: confidence,
                    edgePoints: edge,
                    pendingExposurePct: pendingExposurePct,
                    hasSameFixturePending: !pendingFixtureBets.isEmpty
                )
                let pick = GoalAnalysisResponse.Pick(
                    marketId: market.marketId,
                    market: market.marketName,
                    line: line.name,
                    odds: line.odds,
                    impliedProbability: implied,
                    estimatedProbability: probability.winProbability,
                    edgePoints: edge,
                    confidence: confidence,
                    expectedValuePct: evPct,
                    edge: String(format: "Model %.1f%% vs implied %.1f%% (+%.1fpp)", probability.winProbability * 100, implied * 100, edge),
                    risks: riskNotes(pushProbability: probability.pushProbability, confidence: confidence, winProbability: probability.winProbability),
                    riskFlags: riskFlags(pushProbability: probability.pushProbability, confidence: confidence),
                    noBetReason: nil,
                    recommendedStake: stake
                )

                candidates.append(.init(pick: pick, groupKey: correlationGroupKey(marketId: market.marketId), descriptor: "\(market.marketName) \(line.name)"))
            }
        }

        candidates.sort {
            if $0.pick.expectedValuePct != $1.pick.expectedValuePct {
                return $0.pick.expectedValuePct > $1.pick.expectedValuePct
            }
            if $0.pick.confidence != $1.pick.confidence {
                return $0.pick.confidence > $1.pick.confidence
            }
            return ($0.pick.edgePoints ?? 0) > ($1.pick.edgePoints ?? 0)
        }

        var picks: [GoalAnalysisResponse.Pick] = []
        var usedGroups = Set<String>()
        let exposureCap = (bankroll ?? 0) * maxFixtureExposurePct
        var currentExposure = pendingFixtureBets.reduce(0) { $0 + $1.stake }

        for candidate in candidates {
            if picks.count >= maxPicksPerFixture {
                passReasons.append("\(candidate.descriptor): omitted to keep fixture recommendations focused.")
                continue
            }
            if pendingGroups.contains(candidate.groupKey) {
                passReasons.append("\(candidate.descriptor): omitted because a pending same-fixture bet already occupies this market group.")
                continue
            }
            if pendingFixtureBets.contains(where: { pending in
                correlationScore(
                    marketId: candidate.pick.marketId,
                    lineName: candidate.pick.line,
                    otherMarketId: pending.marketId,
                    otherLineName: pending.lineName ?? pending.market
                ) >= highCorrelationThreshold
            }) {
                passReasons.append("\(candidate.descriptor): omitted due to overlap with an existing pending bet on this fixture.")
                continue
            }
            if usedGroups.contains(candidate.groupKey) {
                passReasons.append("\(candidate.descriptor): omitted due to correlated market exposure.")
                continue
            }

            let maxAcceptedCorrelation = picks.map {
                correlationScore(
                    marketId: candidate.pick.marketId,
                    lineName: candidate.pick.line,
                    otherMarketId: $0.marketId,
                    otherLineName: $0.line
                )
            }.max() ?? 0.0

            if maxAcceptedCorrelation >= highCorrelationThreshold {
                passReasons.append("\(candidate.descriptor): omitted due to high correlation with another recommended pick.")
                continue
            }
            if !picks.isEmpty {
                let edgePoints = candidate.pick.edgePoints ?? 0
                if candidate.pick.confidence < secondPickMinConfidence || edgePoints < secondPickMinEdgePoints || maxAcceptedCorrelation > secondPickMaxCorrelation {
                    passReasons.append("\(candidate.descriptor): omitted because secondary picks must be high-confidence and weakly correlated.")
                    continue
                }
            }
            if let bankroll,
               bankroll > 0,
               exposureCap > 0,
               let stake = candidate.pick.recommendedStake,
               currentExposure + stake > exposureCap {
                passReasons.append("\(candidate.descriptor): omitted due to fixture exposure cap.")
                continue
            }
            picks.append(candidate.pick)
            usedGroups.insert(candidate.groupKey)
            if let stake = candidate.pick.recommendedStake {
                currentExposure += stake
            }
        }

        if passReasons.count > 16 {
            passReasons = Array(passReasons.prefix(16))
        }

        let summary: String?
        if let best = picks.first {
            summary = "\(picks.count) goal value line\(picks.count == 1 ? "" : "s") found. Best: \(best.market) \(best.line) at \(best.odds > 0 ? "+\(best.odds)" : "\(best.odds)") with +\(String(format: "%.1f", best.expectedValuePct))% EV."
        } else {
            summary = "No goal lines met confidence, edge, and EV thresholds for this fixture."
        }

        return .init(picks: picks, passReasons: passReasons, summary: summary)
    }

    private func correlationGroupKey(marketId: Int) -> String {
        switch marketId {
        case Bet.marketGoalsTotal:
            return "total-goals"
        case Bet.marketGoalsHome:
            return "home-goals"
        case Bet.marketGoalsAway:
            return "away-goals"
        case Bet.marketBothTeamsScore:
            return "btts"
        default:
            return "market-\(marketId)"
        }
    }

    private func correlationScore(marketId: Int, lineName: String, otherMarketId: Int, otherLineName: String) -> Double {
        let family = correlationGroupKey(marketId: marketId)
        let otherFamily = correlationGroupKey(marketId: otherMarketId)
        if family == otherFamily { return 1.0 }

        let side = normalizedLineSide(lineName)
        let otherSide = normalizedLineSide(otherLineName)
        let families = Set([family, otherFamily])

        if families == Set(["btts", "total-goals"]) {
            if (side == "yes" && otherSide == "over") || (side == "over" && otherSide == "yes") || (side == "no" && otherSide == "under") || (side == "under" && otherSide == "no") {
                return 0.82
            }
            return 0.25
        }

        if families.contains("total-goals") && (families.contains("home-goals") || families.contains("away-goals")) {
            if side == otherSide, side != "unknown" { return 0.78 }
            return 0.30
        }

        if families == Set(["home-goals", "away-goals"]) {
            if side == otherSide, side != "unknown" { return 0.50 }
            return 0.25
        }

        if families.contains("btts") && (families.contains("home-goals") || families.contains("away-goals")) {
            if (side == "yes" && otherSide == "over") || (side == "over" && otherSide == "yes") || (side == "no" && otherSide == "under") || (side == "under" && otherSide == "no") {
                return 0.68
            }
            return 0.25
        }

        return 0.15
    }

    private func normalizedLineSide(_ lineName: String) -> String {
        let lower = lineName.lowercased()
        if lower.hasPrefix("over") { return "over" }
        if lower.hasPrefix("under") { return "under" }
        if lower.contains("yes") { return "yes" }
        if lower.contains("no") { return "no" }
        return "unknown"
    }

    private func confidenceForLine(marketId: Int, projection: ProjectionInput) -> Double {
        switch marketId {
        case Bet.marketGoalsHome:
            return projection.homeConfidence
        case Bet.marketGoalsAway:
            return projection.awayConfidence
        default:
            return projection.totalConfidence
        }
    }

    private func impliedProbability(fromAmericanOdds odds: Int) -> Double {
        if odds > 0 {
            return 100.0 / (Double(odds) + 100.0)
        }
        let absOdds = Double(abs(odds))
        return absOdds / (absOdds + 100.0)
    }

    private func decimalOdds(fromAmericanOdds odds: Int) -> Double {
        if odds > 0 {
            return 1.0 + (Double(odds) / 100.0)
        }
        return 1.0 + (100.0 / Double(abs(odds)))
    }

    private func recommendedStake(
        bankroll: Double?,
        decimalOdds: Double,
        winProbability: Double,
        confidence: Double,
        edgePoints: Double,
        pendingExposurePct: Double,
        hasSameFixturePending: Bool
    ) -> Double? {
        guard let bankroll, bankroll > 0 else { return nil }
        let b = decimalOdds - 1.0
        guard b > 0 else { return nil }

        let p = winProbability
        let q = 1.0 - p
        let kelly = max(0, ((b * p) - q) / b)
        let confidenceMultiplier = confidence >= 0.74 ? 0.85 : 0.60
        let edgeMultiplier = clamp(edgePoints / 9.0, min: 0.70, max: 1.20)

        var reductionMultiplier = 1.0
        if pendingExposurePct >= 0.15 {
            reductionMultiplier *= 0.5
        } else if pendingExposurePct >= 0.10 {
            reductionMultiplier *= 0.7
        }
        if hasSameFixturePending {
            reductionMultiplier *= 0.7
        }

        let rawStake = bankroll * 0.25 * kelly * confidenceMultiplier * edgeMultiplier * reductionMultiplier
        let maxStake = bankroll * 0.015
        let floorStake = min(max(1.0, bankroll * 0.002), maxStake)
        return min(max(rawStake, floorStake), maxStake)
    }

    /// Requires larger edges at longer odds where Poisson tail estimates are less reliable.
    /// Base threshold (5pp) applies at short favorites. Scales up through plus-money territory.
    private func scaledEdgeThreshold(odds: Int, baseEdge: Double) -> Double {
        if odds <= 0 {
            // Favorites: use base threshold
            return baseEdge
        } else if odds <= 150 {
            // Short plus-money: moderate increase
            return baseEdge * 1.4
        } else if odds <= 250 {
            // Mid plus-money: significant increase
            return baseEdge * 1.8
        } else {
            // Long plus-money (+250 to +400): require strong edge
            return baseEdge * 2.2
        }
    }

    private func riskNotes(pushProbability: Double, confidence: Double, winProbability: Double) -> [String] {
        var notes: [String] = []
        if pushProbability > 0.08 {
            notes.append("Integer line has meaningful push probability.")
        }
        if confidence < 0.64 {
            notes.append("Confidence only moderate; model edge may be fragile.")
        }
        if abs(winProbability - 0.5) < 0.07 {
            notes.append("Projected edge is still close to coin-flip territory.")
        }
        if notes.isEmpty {
            notes.append("Normal scoring variance remains material.")
        }
        return notes
    }

    private func riskFlags(pushProbability: Double, confidence: Double) -> [String]? {
        var flags: [String] = []
        if pushProbability > 0.08 { flags.append("push-risk") }
        if confidence < 0.64 { flags.append("moderate-confidence") }
        return flags.isEmpty ? nil : flags
    }

    private func clamp(_ value: Double, min minValue: Double, max maxValue: Double) -> Double {
        Swift.max(minValue, Swift.min(maxValue, value))
    }
}
