import Foundation

struct LocalCornerProjectionService {
    static let modelVersion = "corner-local-v3.0"

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
        let homeBiasShift: Double
        let awayBiasShift: Double
    }

    private let defaultParams = ModelParams(
        attackWeight: 0.50,
        defenseWeight: 0.50,
        venueWeight: 0.20,
        recentWeight: 0.18,
        paceShotsWeight: 0.0,
        paceShotQualityWeight: 0.0,
        paceTempoQualityWeight: 0.0,
        paceXGWeight: 0.0,
        pacePossessionWeight: 1.0,
        homeBiasShift: 0.25,
        awayBiasShift: -0.25
    )

    private let leagueOverrides: [Int: ModelParams] = [
        // English Championship
        40: ModelParams(
            attackWeight: 0.50,
            defenseWeight: 0.50,
            venueWeight: 0.40,
            recentWeight: 0.12,
            paceShotsWeight: 0.0,
            paceShotQualityWeight: 0.20,
            paceTempoQualityWeight: 0.15,
            paceXGWeight: 0.0,
            pacePossessionWeight: 0.65,
            homeBiasShift: 0.25,
            awayBiasShift: -0.25
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

        expectedHome = clamp(expectedHome + params.homeBiasShift, min: 1.5, max: 9.5)
        expectedAway = clamp(expectedAway + params.awayBiasShift, min: 1.0, max: 8.5)

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

        let probabilityEngine = MarketProbabilityEngine()
        let decisionEngine = OddsDecisionEngine()
        let marketInputs = payload.markets.map { market in
            OddsDecisionEngine.MarketInput(
                marketId: market.id,
                marketName: market.name,
                lines: market.lines.map {
                    OddsDecisionEngine.LineInput(name: $0.name, odds: $0.odds)
                }
            )
        }

        let projected = OddsDecisionEngine.ProjectionInput(
            expectedHomeCorners: expectedHome,
            expectedAwayCorners: expectedAway,
            expectedTotalCorners: total,
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
            picks: decision.picks,
            pass: decision.passReasons,
            recommendation: decision.picks.isEmpty ? "PASS" : "BET",
            summary: decision.summary ?? summary
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
        let alignment = teamSignalAlignment(team: team)

        let score = (seasonDepth * 0.4) + (venueDepth * 0.2) + (stability * 0.2) + (alignment * 0.2)
        return clamp(0.50 + (score * 0.28), min: 0.50, max: 0.78)
    }

    private func teamSignalAlignment(team: CornerAnalysisPayload.TeamAnalysisData) -> Double {
        var attackSignals = [team.seasonCornersFor, team.venueCornersFor]
        var defenseSignals = [team.seasonCornersAgainst, team.venueCornersAgainst]

        if let recentAttack = mean(team.recentForm.map({ Double($0.cornersWon) })) {
            attackSignals.append(recentAttack)
        }
        if let recentDefense = mean(team.recentForm.map({ Double($0.cornersConceded) })) {
            defenseSignals.append(recentDefense)
        }

        let attackDispersion = sampleStandardDeviation(attackSignals)
        let defenseDispersion = sampleStandardDeviation(defenseSignals)
        let averageDispersion = (attackDispersion + defenseDispersion) / 2.0
        return 1.0 - min(averageDispersion / 2.5, 1.0)
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

private struct MarketProbabilityEngine {
    enum Side {
        case over
        case under
        case home
        case away
        case draw
        case exactly
    }

    struct LineProbability {
        let winProbability: Double
        let pushProbability: Double
    }

    func probability(
        marketId: Int,
        lineName: String,
        expectedHomeCorners: Double,
        expectedAwayCorners: Double,
        expectedTotalCorners: Double
    ) -> LineProbability? {
        guard let side = parseSide(lineName: lineName) else { return nil }

        switch marketId {
        case 45, 56:
            guard let lineValue = extractLineValue(from: lineName) else { return nil }
            return probabilityForTotal(side: side, lineValue: lineValue, lambdaTotal: expectedTotalCorners)
        case 57:
            guard let lineValue = extractLineValue(from: lineName) else { return nil }
            return probabilityForTeam(side: side, lineValue: lineValue, lambda: expectedHomeCorners)
        case 58:
            guard let lineValue = extractLineValue(from: lineName) else { return nil }
            return probabilityForTeam(side: side, lineValue: lineValue, lambda: expectedAwayCorners)
        case 55:
            return probabilityMostCorners(side: side, lambdaHome: expectedHomeCorners, lambdaAway: expectedAwayCorners)
        case 85:
            guard let lineValue = extractLineValue(from: lineName) else { return nil }
            return probabilityForThreeWayTotal(side: side, lineValue: lineValue, lambdaTotal: expectedTotalCorners)
        default:
            return nil
        }
    }

    private func probabilityForTotal(side: Side, lineValue: Double, lambdaTotal: Double) -> LineProbability {
        probabilityForCount(side: side, lineValue: lineValue, lambda: lambdaTotal)
    }

    private func probabilityForTeam(side: Side, lineValue: Double, lambda: Double) -> LineProbability {
        probabilityForCount(side: side, lineValue: lineValue, lambda: lambda)
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
        case .exactly:
            let exact = poissonPMF(k: Int(round(lineValue)), lambda: lambda)
            return .init(winProbability: exact, pushProbability: 0)
        default:
            return .init(winProbability: 0, pushProbability: 0)
        }
    }

    private func probabilityMostCorners(side: Side, lambdaHome: Double, lambdaAway: Double) -> LineProbability {
        let maxK = max(30, Int((lambdaHome + lambdaAway) + 20))
        var pHome = [Double](repeating: 0, count: maxK + 1)
        var pAway = [Double](repeating: 0, count: maxK + 1)

        for k in 0...maxK {
            pHome[k] = poissonPMF(k: k, lambda: lambdaHome)
            pAway[k] = poissonPMF(k: k, lambda: lambdaAway)
        }

        var homeGreater = 0.0
        var awayGreater = 0.0
        var draw = 0.0

        for h in 0...maxK {
            for a in 0...maxK {
                let p = pHome[h] * pAway[a]
                if h > a {
                    homeGreater += p
                } else if h < a {
                    awayGreater += p
                } else {
                    draw += p
                }
            }
        }

        switch side {
        case .home:
            return .init(winProbability: homeGreater, pushProbability: 0)
        case .away:
            return .init(winProbability: awayGreater, pushProbability: 0)
        case .draw:
            return .init(winProbability: draw, pushProbability: 0)
        default:
            return .init(winProbability: 0, pushProbability: 0)
        }
    }

    private func probabilityForThreeWayTotal(side: Side, lineValue: Double, lambdaTotal: Double) -> LineProbability {
        let n = Int(round(lineValue))
        switch side {
        case .over:
            let win = 1.0 - poissonCDF(k: n, lambda: lambdaTotal)
            return .init(winProbability: win, pushProbability: 0)
        case .under:
            let win = poissonCDF(k: n - 1, lambda: lambdaTotal)
            return .init(winProbability: win, pushProbability: 0)
        case .exactly, .draw:
            return .init(winProbability: poissonPMF(k: n, lambda: lambdaTotal), pushProbability: 0)
        default:
            return .init(winProbability: 0, pushProbability: 0)
        }
    }

    private func parseSide(lineName: String) -> Side? {
        let lower = lineName.lowercased()
        if lower.hasPrefix("over") { return .over }
        if lower.hasPrefix("under") { return .under }
        if lower.hasPrefix("home") { return .home }
        if lower.hasPrefix("away") { return .away }
        if lower.hasPrefix("exactly") { return .exactly }
        if lower == "draw" { return .draw }
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

private struct OddsDecisionEngine {
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
        let expectedHomeCorners: Double
        let expectedAwayCorners: Double
        let expectedTotalCorners: Double
        let homeConfidence: Double
        let awayConfidence: Double
        let totalConfidence: Double
    }

    struct DecisionResult {
        let picks: [CornerAnalysisResponse.Pick]
        let passReasons: [String]
        let summary: String?
    }

    private struct CandidatePick {
        let pick: CornerAnalysisResponse.Pick
        let groupKey: String
        let descriptor: String
    }

    private let minConfidence = 0.70
    private let minEdgePoints = 5.0
    private let minEVPct = 4.0
    private let shortestAllowedFavoriteOdds = -190
    private let maxPicksPerFixture = 2
    private let maxFixtureExposurePct = 0.03
    private let secondPickMinConfidence = 0.74
    private let secondPickMinEdgePoints = 8.0
    private let highCorrelationThreshold = 0.65
    private let secondPickMaxCorrelation = 0.35
    private let pendingExposureTightenPct = 0.10

    func selectBets(
        fixtureId: Int,
        projection: ProjectionInput,
        markets: [MarketInput],
        bankroll: Double?,
        pendingBets: [CornerAnalysisPayload.PendingBet],
        probabilityEngine: MarketProbabilityEngine
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
            return .init(
                picks: [],
                passReasons: ["No corner markets available for this fixture."],
                summary: nil
            )
        }

        for market in markets {
            for line in market.lines {
                guard let probability = probabilityEngine.probability(
                    marketId: market.marketId,
                    lineName: line.name,
                    expectedHomeCorners: projection.expectedHomeCorners,
                    expectedAwayCorners: projection.expectedAwayCorners,
                    expectedTotalCorners: projection.expectedTotalCorners
                ) else {
                    passReasons.append("\(market.marketName) \(line.name): unsupported line format.")
                    continue
                }

                let implied = impliedProbability(fromAmericanOdds: line.odds)
                let edge = (probability.winProbability - implied) * 100
                let confidence = confidenceForLine(
                    marketId: market.marketId,
                    lineName: line.name,
                    projection: projection,
                    probabilityEngine: probabilityEngine
                )

                let decimalOdds = decimalOdds(fromAmericanOdds: line.odds)
                let loseProbability = max(0, 1.0 - probability.winProbability - probability.pushProbability)
                let evPerUnit = (probability.winProbability * (decimalOdds - 1.0)) - loseProbability
                let evPct = evPerUnit * 100

                if line.odds < shortestAllowedFavoriteOdds {
                    passReasons.append("\(market.marketName) \(line.name): odds \(line.odds) too short for target return.")
                    continue
                }

                guard confidence >= effectiveMinConfidence else {
                    passReasons.append("\(market.marketName) \(line.name): confidence \(Int(confidence * 100))% below threshold.")
                    continue
                }
                guard edge >= effectiveMinEdgePoints else {
                    passReasons.append("\(market.marketName) \(line.name): edge \(String(format: "%.1f", edge))pp below threshold.")
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
                let edgeText = String(
                    format: "Model %.1f%% vs implied %.1f%% (+%.1fpp)",
                    probability.winProbability * 100,
                    implied * 100,
                    edge
                )

                let pick = CornerAnalysisResponse.Pick(
                        marketId: market.marketId,
                        market: market.marketName,
                        line: line.name,
                        odds: line.odds,
                        impliedProbability: implied,
                        estimatedProbability: probability.winProbability,
                        edgePoints: edge,
                        confidence: confidence,
                        expectedValuePct: evPct,
                        edge: edgeText,
                        risks: riskNotes(
                            pushProbability: probability.pushProbability,
                            confidence: confidence,
                            winProbability: probability.winProbability
                        ),
                        riskFlags: riskFlags(
                            pushProbability: probability.pushProbability,
                            confidence: confidence,
                            stake: stake,
                            bankroll: bankroll
                        ),
                        noBetReason: nil,
                        recommendedStake: stake
                    )

                candidates.append(
                    CandidatePick(
                        pick: pick,
                        groupKey: correlationGroupKey(marketId: market.marketId),
                        descriptor: "\(market.marketName) \(line.name)"
                    )
                )
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

        var picks: [CornerAnalysisResponse.Pick] = []
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
            summary = "\(picks.count) value line\(picks.count == 1 ? "" : "s") found. Best: \(best.market) \(best.line) at \(best.odds > 0 ? "+\(best.odds)" : "\(best.odds)") with +\(String(format: "%.1f", best.expectedValuePct))% EV."
        } else {
            summary = "No lines met confidence, edge, and EV thresholds for this fixture."
        }

        return .init(picks: picks, passReasons: passReasons, summary: summary)
    }

    private func correlationGroupKey(marketId: Int) -> String {
        switch marketId {
        case 45, 56, 85:
            return "total-corners"
        case 57:
            return "home-corners"
        case 58:
            return "away-corners"
        case 55:
            return "most-corners"
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

        if Set([family, otherFamily]).isSuperset(of: ["total-corners", "home-corners"]) ||
            Set([family, otherFamily]).isSuperset(of: ["total-corners", "away-corners"]) {
            if side == otherSide, side != "unknown" { return 0.78 }
            return 0.35
        }

        if Set([family, otherFamily]).isSuperset(of: ["home-corners", "away-corners"]) {
            if side == otherSide, side != "unknown" { return 0.45 }
            return 0.20
        }

        if family == "most-corners" || otherFamily == "most-corners" {
            let mostSide = family == "most-corners" ? side : otherSide
            let teamFamily = family == "most-corners" ? otherFamily : family
            if (mostSide == "home" && teamFamily == "home-corners") || (mostSide == "away" && teamFamily == "away-corners") {
                return 0.72
            }
            if teamFamily == "total-corners" { return 0.45 }
            return 0.25
        }

        return 0.15
    }

    private func normalizedLineSide(_ lineName: String) -> String {
        let lower = lineName.lowercased()
        if lower.hasPrefix("over") { return "over" }
        if lower.hasPrefix("under") { return "under" }
        if lower.hasPrefix("home") { return "home" }
        if lower.hasPrefix("away") { return "away" }
        if lower.hasPrefix("draw") { return "draw" }
        return "unknown"
    }

    private func confidenceForLine(
        marketId: Int,
        lineName: String,
        projection: ProjectionInput,
        probabilityEngine: MarketProbabilityEngine
    ) -> Double {
        switch marketId {
        case 57:
            return projection.homeConfidence
        case 58:
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
        let absOdds = Double(abs(odds))
        return 1.0 + (100.0 / absOdds)
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
        let confidenceMultiplier: Double
        let maxPctCap: Double

        if confidence >= 0.78 {
            confidenceMultiplier = 0.95
            maxPctCap = 0.02
        } else if confidence >= 0.72 {
            confidenceMultiplier = 0.78
            maxPctCap = 0.015
        } else {
            confidenceMultiplier = 0.55
            maxPctCap = 0.01
        }

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
        let maxStake = bankroll * maxPctCap
        let floorStake = min(max(1.0, bankroll * 0.002), maxStake)
        return min(max(rawStake, floorStake), maxStake)
    }

    private func riskNotes(pushProbability: Double, confidence: Double, winProbability: Double) -> [String] {
        var notes: [String] = []
        if pushProbability >= 0.08 {
            notes.append("Meaningful push probability around the line")
        }
        if confidence < 0.7 {
            notes.append("Moderate model confidence")
        }
        if winProbability < 0.5 {
            notes.append("Outcome remains high variance")
        }
        return notes
    }

    private func riskFlags(pushProbability: Double, confidence: Double, stake: Double?, bankroll: Double?) -> [String] {
        var flags: [String] = []
        if pushProbability >= 0.08 {
            flags.append("push_risk")
        }
        if confidence < 0.7 {
            flags.append("mid_confidence")
        }
        if let stake, let bankroll, bankroll > 0, stake >= bankroll * 0.0199 {
            flags.append("stake_capped")
        }
        return flags
    }

    private func clamp(_ value: Double, min minValue: Double, max maxValue: Double) -> Double {
        Swift.max(minValue, Swift.min(maxValue, value))
    }
}
