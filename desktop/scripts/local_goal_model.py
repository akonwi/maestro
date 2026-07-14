#!/usr/bin/env python3

from __future__ import annotations

from dataclasses import dataclass
from math import exp, sqrt


MODEL_VERSION = "goal-local-v1.0"


@dataclass(frozen=True)
class ModelParams:
    attack_weight: float = 0.55
    defense_weight: float = 0.45
    venue_weight: float = 0.35
    recent_weight: float = 0.22
    goals_weight: float = 0.55
    xg_weight: float = 0.45
    shot_volume_weight: float = 0.30
    shot_quality_weight: float = 0.35
    possession_weight: float = 0.10
    finishing_weight: float = 0.25
    home_advantage_goals: float = 0.18


DEFAULT_PARAMS = ModelParams()

LEAGUE_MODEL_PARAMS: dict[int, ModelParams] = {
    # English Championship
    40: ModelParams(
        attack_weight=0.56,
        defense_weight=0.44,
        venue_weight=0.42,
        recent_weight=0.18,
        goals_weight=0.52,
        xg_weight=0.48,
        shot_volume_weight=0.32,
        shot_quality_weight=0.36,
        possession_weight=0.08,
        finishing_weight=0.24,
        home_advantage_goals=0.16,
    ),
}


def params_for_league(league_id: int, fallback: ModelParams | None = None) -> ModelParams:
    base = fallback or DEFAULT_PARAMS
    return LEAGUE_MODEL_PARAMS.get(league_id, base)


@dataclass
class RecentFixture:
    goals_for: int
    goals_against: int
    xg_for: float
    xg_against: float


@dataclass
class TeamModelInput:
    season_games: int
    season_goals_for: float
    season_goals_against: float
    season_xg_for: float
    season_xg_against: float
    venue_games: int
    venue_goals_for: float
    venue_goals_against: float
    venue_xg_for: float
    venue_xg_against: float
    shots_per_game: float
    shots_on_goal_per_game: float
    shots_in_box_share: float
    xg_per_game: float
    xg_against_per_game: float
    possession_avg: float
    recent_form: list[RecentFixture]


@dataclass
class ProjectionResult:
    expected_home_goals: float
    expected_away_goals: float
    expected_total_goals: float
    over_2_5_prob: float
    btts_prob: float
    confidence: float


def project(home: TeamModelInput, away: TeamModelInput, params: ModelParams | None = None) -> ProjectionResult:
    p = params or DEFAULT_PARAMS

    home_attack = _blended_attack_strength(
        home,
        recent_weight=p.recent_weight,
        venue_weight=p.venue_weight,
        goals_weight=p.goals_weight,
        xg_weight=p.xg_weight,
    )
    away_attack = _blended_attack_strength(
        away,
        recent_weight=p.recent_weight,
        venue_weight=p.venue_weight,
        goals_weight=p.goals_weight,
        xg_weight=p.xg_weight,
    )
    home_defense = _blended_defense_leak(
        home,
        recent_weight=p.recent_weight,
        venue_weight=p.venue_weight,
        goals_weight=p.goals_weight,
        xg_weight=p.xg_weight,
    )
    away_defense = _blended_defense_leak(
        away,
        recent_weight=p.recent_weight,
        venue_weight=p.venue_weight,
        goals_weight=p.goals_weight,
        xg_weight=p.xg_weight,
    )

    expected_home = (p.attack_weight * home_attack) + (p.defense_weight * away_defense)
    expected_away = (p.attack_weight * away_attack) + (p.defense_weight * home_defense)

    home_attack_factor = _attack_quality_adjustment(
        home,
        shot_volume_weight=p.shot_volume_weight,
        shot_quality_weight=p.shot_quality_weight,
        possession_weight=p.possession_weight,
        finishing_weight=p.finishing_weight,
    )
    away_attack_factor = _attack_quality_adjustment(
        away,
        shot_volume_weight=p.shot_volume_weight,
        shot_quality_weight=p.shot_quality_weight,
        possession_weight=p.possession_weight,
        finishing_weight=p.finishing_weight,
    )

    away_defense_factor = _defense_concession_adjustment(away)
    home_defense_factor = _defense_concession_adjustment(home)

    expected_home *= home_attack_factor * away_defense_factor
    expected_away *= away_attack_factor * home_defense_factor

    expected_home += p.home_advantage_goals
    expected_away = max(0.05, expected_away - (p.home_advantage_goals * 0.35))

    expected_home = _clamp(expected_home, 0.20, 3.80)
    expected_away = _clamp(expected_away, 0.15, 3.40)
    expected_total = expected_home + expected_away

    over_2_5_prob = _poisson_over_total(expected_total, threshold=2)
    btts_prob = (1.0 - _poisson_pmf_zero(expected_home)) * (1.0 - _poisson_pmf_zero(expected_away))
    confidence = _projection_confidence(home, away)

    return ProjectionResult(
        expected_home_goals=expected_home,
        expected_away_goals=expected_away,
        expected_total_goals=expected_total,
        over_2_5_prob=over_2_5_prob,
        btts_prob=btts_prob,
        confidence=confidence,
    )


def _blended_attack_strength(
    team: TeamModelInput,
    recent_weight: float,
    venue_weight: float,
    goals_weight: float,
    xg_weight: float,
) -> float:
    season_weight = _normalized_weight(team.season_games, 24)
    venue_sample_weight = _normalized_weight(team.venue_games, 14)
    applied_recent_weight = 0.0 if not team.recent_form else recent_weight

    season_value = _weighted_mean(
        values=[max(team.season_goals_for, 0.0), max(team.season_xg_for, 0.0)],
        weights=[goals_weight, xg_weight],
    ) or max(team.season_goals_for, 0.0)
    venue_value = _weighted_mean(
        values=[max(team.venue_goals_for, 0.0), max(team.venue_xg_for, 0.0)],
        weights=[goals_weight, xg_weight],
    ) or season_value

    recent_goals = _mean([float(x.goals_for) for x in team.recent_form])
    recent_xg = _mean([float(x.xg_for) for x in team.recent_form])
    recent_value = _weighted_mean(
        values=[recent_goals if recent_goals is not None else season_value, recent_xg if recent_xg is not None else season_value],
        weights=[goals_weight, xg_weight],
    ) or season_value

    seasonal_blend = _weighted_mean(
        values=[season_value, venue_value],
        weights=[max(0.2, season_weight), max(0.1, venue_weight * venue_sample_weight)],
    )
    if seasonal_blend is None:
        seasonal_blend = season_value

    output = _weighted_mean(
        values=[seasonal_blend, recent_value],
        weights=[max(0.65, 1.0 - applied_recent_weight), applied_recent_weight],
    )
    return seasonal_blend if output is None else output


def _blended_defense_leak(
    team: TeamModelInput,
    recent_weight: float,
    venue_weight: float,
    goals_weight: float,
    xg_weight: float,
) -> float:
    season_weight = _normalized_weight(team.season_games, 24)
    venue_sample_weight = _normalized_weight(team.venue_games, 14)

    season_value = _weighted_mean(
        values=[max(team.season_goals_against, 0.0), max(team.season_xg_against, 0.0)],
        weights=[goals_weight, xg_weight],
    ) or max(team.season_goals_against, 0.0)
    venue_value = _weighted_mean(
        values=[max(team.venue_goals_against, 0.0), max(team.venue_xg_against, 0.0)],
        weights=[goals_weight, xg_weight],
    ) or season_value

    recent_ga = _mean([float(x.goals_against) for x in team.recent_form])
    recent_xga = _mean([float(x.xg_against) for x in team.recent_form])
    recent_value = _weighted_mean(
        values=[recent_ga if recent_ga is not None else season_value, recent_xga if recent_xga is not None else season_value],
        weights=[goals_weight, xg_weight],
    ) or season_value

    seasonal_blend = _weighted_mean(
        values=[season_value, venue_value],
        weights=[max(0.2, season_weight), max(0.1, venue_weight * venue_sample_weight)],
    )
    if seasonal_blend is None:
        seasonal_blend = season_value

    output = _weighted_mean(
        values=[seasonal_blend, recent_value],
        weights=[max(0.65, 1.0 - recent_weight), recent_weight],
    )
    return seasonal_blend if output is None else output


def _attack_quality_adjustment(
    team: TeamModelInput,
    shot_volume_weight: float,
    shot_quality_weight: float,
    possession_weight: float,
    finishing_weight: float,
) -> float:
    shots_baseline = 12.0
    shots_on_goal_baseline = 4.1
    shots_in_box_share_baseline = 0.52
    possession_baseline = 0.50

    shots_factor = _clamp(team.shots_per_game / shots_baseline, 0.88, 1.15)
    shots_on_goal_factor = _clamp(team.shots_on_goal_per_game / shots_on_goal_baseline, 0.88, 1.15)
    shot_quality_factor = _clamp(
        (0.55 * shots_on_goal_factor) + (0.45 * _clamp(team.shots_in_box_share / shots_in_box_share_baseline, 0.90, 1.12)),
        0.88,
        1.14,
    )
    possession_factor = _clamp(team.possession_avg / possession_baseline, 0.95, 1.05)

    expected_goals_floor = max(team.xg_per_game, 0.25)
    finishing_factor = _clamp(team.season_goals_for / expected_goals_floor, 0.88, 1.12)

    total_weight = shot_volume_weight + shot_quality_weight + possession_weight + finishing_weight
    if total_weight <= 0:
        return 1.0

    return _clamp(
        (
            (shots_factor * shot_volume_weight)
            + (shot_quality_factor * shot_quality_weight)
            + (possession_factor * possession_weight)
            + (finishing_factor * finishing_weight)
        ) / total_weight,
        0.88,
        1.14,
    )


def _defense_concession_adjustment(team: TeamModelInput) -> float:
    xga_baseline = 1.25
    goals_against_baseline = 1.35

    xga_factor = _clamp(team.xg_against_per_game / xga_baseline, 0.88, 1.14)
    ga_factor = _clamp(team.season_goals_against / goals_against_baseline, 0.88, 1.14)

    return _clamp((xga_factor * 0.6) + (ga_factor * 0.4), 0.88, 1.14)


def _projection_confidence(home: TeamModelInput, away: TeamModelInput) -> float:
    season_depth = min(float(min(home.season_games, away.season_games)) / 24.0, 1.0)
    venue_depth = min(float(min(home.venue_games, away.venue_games)) / 14.0, 1.0)

    home_variance = _sample_stddev([float(x.goals_for + x.goals_against) for x in home.recent_form])
    away_variance = _sample_stddev([float(x.goals_for + x.goals_against) for x in away.recent_form])
    avg_variance = (home_variance + away_variance) / 2
    stability = 1.0 - min(avg_variance / 2.4, 1.0)

    score = (season_depth * 0.5) + (venue_depth * 0.25) + (stability * 0.25)
    return _clamp(0.50 + (score * 0.30), 0.50, 0.80)


def _poisson_pmf_zero(lam: float) -> float:
    return exp(-lam)


def _poisson_over_total(lam: float, threshold: int) -> float:
    cumulative = 0.0
    term = exp(-lam)
    cumulative += term
    for k in range(1, threshold + 1):
        term *= lam / float(k)
        cumulative += term
    return _clamp(1.0 - cumulative, 0.0, 1.0)


def _weighted_mean(values: list[float], weights: list[float]) -> float | None:
    if len(values) != len(weights) or not values:
        return None
    total_weight = sum(weights)
    if total_weight <= 0:
        return None
    weighted_total = 0.0
    for value, weight in zip(values, weights):
        weighted_total += value * weight
    return weighted_total / total_weight


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / float(len(values))


def _sample_stddev(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0
    avg = sum(values) / float(len(values))
    variance = sum((value - avg) ** 2 for value in values) / float(len(values) - 1)
    return sqrt(variance)


def _normalized_weight(sample_size: int, cap: int) -> float:
    if cap <= 0:
        return 0.0
    return min(float(sample_size) / float(cap), 1.0)


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))
