#!/usr/bin/env python3

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt


MODEL_VERSION = "corner-local-v1.0"


@dataclass(frozen=True)
class ModelParams:
    attack_weight: float = 0.50
    defense_weight: float = 0.50
    venue_weight: float = 0.20
    recent_weight: float = 0.28
    pace_weight_shots: float = 0.0
    pace_weight_shot_quality: float = 0.0
    pace_weight_tempo_quality: float = 0.0
    pace_weight_xg: float = 0.0
    pace_weight_possession: float = 1.0


DEFAULT_PARAMS = ModelParams()

LEAGUE_MODEL_PARAMS: dict[int, ModelParams] = {
    # English Championship
    40: ModelParams(
        attack_weight=0.50,
        defense_weight=0.50,
        venue_weight=0.60,
        recent_weight=0.06,
        pace_weight_shots=0.0,
        pace_weight_shot_quality=0.0,
        pace_weight_tempo_quality=0.0,
        pace_weight_xg=0.0,
        pace_weight_possession=1.0,
    ),
}


def params_for_league(league_id: int, fallback: ModelParams | None = None) -> ModelParams:
    base = fallback or DEFAULT_PARAMS
    return LEAGUE_MODEL_PARAMS.get(league_id, base)


@dataclass
class RecentFixture:
    corners_won: int
    corners_conceded: int


@dataclass
class TeamModelInput:
    season_games: int
    season_corners_for: float
    season_corners_against: float
    venue_games: int
    venue_corners_for: float
    venue_corners_against: float
    shots_per_game: float
    shots_on_goal_per_game: float
    shots_in_box_share: float
    passes_per_game: float
    pass_completion_rate: float
    xg_per_game: float
    possession_avg: float
    recent_form: list[RecentFixture]


@dataclass
class ProjectionResult:
    expected_home_corners: float
    expected_away_corners: float
    expected_total_corners: float
    confidence: float


def project(home: TeamModelInput, away: TeamModelInput, params: ModelParams | None = None) -> ProjectionResult:
    p = params or DEFAULT_PARAMS

    home_attack = _blended_attack_strength(home, recent_weight=p.recent_weight, venue_weight=p.venue_weight)
    away_attack = _blended_attack_strength(away, recent_weight=p.recent_weight, venue_weight=p.venue_weight)
    home_defense_leak = _blended_defense_leak(home, recent_weight=p.recent_weight, venue_weight=p.venue_weight)
    away_defense_leak = _blended_defense_leak(away, recent_weight=p.recent_weight, venue_weight=p.venue_weight)

    expected_home = p.attack_weight * home_attack + p.defense_weight * away_defense_leak
    expected_away = p.attack_weight * away_attack + p.defense_weight * home_defense_leak

    pace_factor = _pace_adjustment(
        home,
        away,
        shots_weight=p.pace_weight_shots,
        shot_quality_weight=p.pace_weight_shot_quality,
        tempo_quality_weight=p.pace_weight_tempo_quality,
        xg_weight=p.pace_weight_xg,
        possession_weight=p.pace_weight_possession,
    )
    expected_home *= pace_factor
    expected_away *= pace_factor

    expected_home = _clamp(expected_home, 1.5, 9.5)
    expected_away = _clamp(expected_away, 1.0, 8.5)
    confidence = _projection_confidence(home, away)

    return ProjectionResult(
        expected_home_corners=expected_home,
        expected_away_corners=expected_away,
        expected_total_corners=expected_home + expected_away,
        confidence=confidence,
    )


def _blended_attack_strength(team: TeamModelInput, recent_weight: float, venue_weight: float) -> float:
    season_weight = _normalized_weight(team.season_games, 24)
    venue_sample_weight = _normalized_weight(team.venue_games, 14)
    applied_recent_weight = 0.0 if not team.recent_form else recent_weight

    season_value = max(team.season_corners_for, 0.0)
    venue_value = max(team.venue_corners_for, 0.0)
    recent_value = _mean([float(x.corners_won) for x in team.recent_form])
    if recent_value is None:
        recent_value = season_value

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


def _blended_defense_leak(team: TeamModelInput, recent_weight: float, venue_weight: float) -> float:
    season_weight = _normalized_weight(team.season_games, 24)
    venue_sample_weight = _normalized_weight(team.venue_games, 14)

    recent_conceded = _mean([float(x.corners_conceded) for x in team.recent_form])
    if recent_conceded is None:
        recent_conceded = team.season_corners_against

    seasonal_leak = _weighted_mean(
        values=[max(team.season_corners_against, 0.0), max(team.venue_corners_against, 0.0)],
        weights=[max(0.2, season_weight), max(0.1, venue_weight * venue_sample_weight)],
    )
    if seasonal_leak is None:
        seasonal_leak = max(team.season_corners_against, 0.0)

    output = _weighted_mean(
        values=[seasonal_leak, recent_conceded],
        weights=[max(0.65, 1.0 - recent_weight), recent_weight],
    )
    return seasonal_leak if output is None else output


def _pace_adjustment(
    home: TeamModelInput,
    away: TeamModelInput,
    shots_weight: float,
    shot_quality_weight: float,
    tempo_quality_weight: float,
    xg_weight: float,
    possession_weight: float,
) -> float:
    shots_baseline = 12.0
    shots_on_goal_rate_baseline = 0.32
    shots_in_box_share_baseline = 0.55
    passes_baseline = 420.0
    pass_completion_baseline = 0.78
    xg_baseline = 1.2
    possession_baseline = 0.5

    avg_shots = (home.shots_per_game + away.shots_per_game) / 2
    avg_shots_on_goal = (home.shots_on_goal_per_game + away.shots_on_goal_per_game) / 2
    avg_shots_in_box_share = (home.shots_in_box_share + away.shots_in_box_share) / 2
    avg_passes_per_game = (home.passes_per_game + away.passes_per_game) / 2
    avg_pass_completion_rate = (home.pass_completion_rate + away.pass_completion_rate) / 2
    avg_xg = (home.xg_per_game + away.xg_per_game) / 2
    avg_possession = (home.possession_avg + away.possession_avg) / 2

    shots_factor = _clamp(avg_shots / shots_baseline, 0.9, 1.12)
    shots_on_goal_rate = (avg_shots_on_goal / avg_shots) if avg_shots > 0 else shots_on_goal_rate_baseline
    shot_quality_factor = _clamp(
        (0.5 * (shots_on_goal_rate / shots_on_goal_rate_baseline))
        + (0.5 * (avg_shots_in_box_share / shots_in_box_share_baseline)),
        0.9,
        1.12,
    )
    tempo_quality_factor = _clamp(
        (0.5 * (avg_passes_per_game / passes_baseline))
        + (0.5 * (avg_pass_completion_rate / pass_completion_baseline)),
        0.9,
        1.12,
    )
    xg_factor = _clamp(avg_xg / xg_baseline, 0.9, 1.12)
    possession_factor = _clamp(avg_possession / possession_baseline, 0.95, 1.05)

    total_weight = shots_weight + shot_quality_weight + tempo_quality_weight + xg_weight + possession_weight
    if total_weight <= 0:
        shots_component = 0.0
        shot_quality_component = 0.0
        tempo_quality_component = 0.0
        xg_component = 0.0
        possession_component = 1.0
    else:
        shots_component = shots_weight / total_weight
        shot_quality_component = shot_quality_weight / total_weight
        tempo_quality_component = tempo_quality_weight / total_weight
        xg_component = xg_weight / total_weight
        possession_component = possession_weight / total_weight

    return _clamp(
        (shots_factor * shots_component)
        + (shot_quality_factor * shot_quality_component)
        + (tempo_quality_factor * tempo_quality_component)
        + (xg_factor * xg_component)
        + (possession_factor * possession_component),
        0.9,
        1.12,
    )


def _projection_confidence(home: TeamModelInput, away: TeamModelInput) -> float:
    season_depth = min(float(min(home.season_games, away.season_games)) / 24.0, 1.0)
    venue_depth = min(float(min(home.venue_games, away.venue_games)) / 14.0, 1.0)

    home_variance = _sample_stddev(
        [float(x.corners_won + x.corners_conceded) for x in home.recent_form]
    )
    away_variance = _sample_stddev(
        [float(x.corners_won + x.corners_conceded) for x in away.recent_form]
    )
    avg_variance = (home_variance + away_variance) / 2
    stability = 1.0 - min(avg_variance / 5.0, 1.0)

    score = (season_depth * 0.5) + (venue_depth * 0.3) + (stability * 0.2)
    return _clamp(0.52 + (score * 0.3), 0.52, 0.82)


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
