"""Generic, pluggable song scoring engine.

Metrics are loaded from metrics.yml at startup. Two types are supported:

  binary     — returns 0 or 100 based on text regex and genre keywords
  graduated  — combines genre matching, subgenre bonuses, audio boosts, and tempo ranges

To add a new metric, just add an entry to backend/app/metrics.yml — no code changes needed.

For metrics that need custom logic beyond what YAML supports, use the @scorer decorator:

    @scorer("rock")
    def score_rock(data: TrackData) -> int:
        ...
"""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import TypedDict

import yaml

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class TrackData(TypedDict):
    track: dict              # Spotify track object
    artist_genres: list[str] # Merged genres from track's own artists
    album_genres: list[str]  # Merged genres from ALL artists on the album
    audio_features: dict     # From ReccoBeats (energy, danceability, tempo, etc.)


Scorer = Callable[[TrackData], int]

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

SCORERS: dict[str, Scorer] = {}
METRIC_CONFIGS: dict[str, dict] = {}  # {name: {color, type}}


def scorer(name: str, color: str = "#1DB954"):
    """Decorator to register a custom scorer function under *name*."""
    def decorator(fn: Scorer) -> Scorer:
        SCORERS[name] = fn
        METRIC_CONFIGS[name] = {"color": color, "type": "custom"}
        return fn
    return decorator


def score_track(track: dict) -> dict[str, int]:
    """Run all registered scorers on an enriched track. Returns {name: 0-100}."""
    data = TrackData(
        track=track,
        artist_genres=[g.lower() for g in track.get("_artist_genres", [])],
        album_genres=[g.lower() for g in track.get("_album_genres", [])],
        audio_features=track.get("_audio_features", {}),
    )
    return {name: max(0, min(100, fn(data))) for name, fn in SCORERS.items()}


def get_scorer_names() -> list[str]:
    """Return all registered criterion names."""
    return list(SCORERS.keys())


def get_metric_configs() -> dict[str, dict]:
    """Return config (color, type) for all registered metrics."""
    return METRIC_CONFIGS


def compute_weighted_score(track_scores: dict[str, int], weights: dict[str, int]) -> float:
    """Compute a weighted score for a track given metric weights.

    Returns 0-100 float. If all weights are 0, returns 0.
    """
    total_weight = sum(w for w in weights.values() if w > 0)
    if total_weight == 0:
        return 0.0
    weighted_sum = sum(track_scores.get(name, 0) * w for name, w in weights.items() if w > 0)
    return weighted_sum / total_weight


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _genre_contains(genres: list[str], *keywords: str) -> bool:
    return any(kw in g for g in genres for kw in keywords)


def _text_matches(track: dict, pattern: re.Pattern) -> bool:
    """Check if track name, album name, or any artist name matches a regex."""
    if pattern.search(track.get("name", "")):
        return True
    if pattern.search(track.get("album", {}).get("name", "")):
        return True
    for artist in track.get("artists", []):
        if pattern.search(artist.get("name", "")):
            return True
    return False


# ---------------------------------------------------------------------------
# YAML config loader
# ---------------------------------------------------------------------------

def _build_binary_scorer(cfg: dict) -> Scorer:
    """Build a binary scorer (0 or 100) from YAML config."""
    pattern = re.compile(cfg["text_regex"]) if "text_regex" in cfg else None
    keywords = tuple(cfg.get("genre_keywords", []))

    def score(data: TrackData) -> int:
        if pattern and _text_matches(data["track"], pattern):
            return 100
        if keywords and _genre_contains(data["artist_genres"], *keywords):
            return 100
        if keywords and _genre_contains(data["album_genres"], *keywords):
            return 100
        return 0

    return score


def _build_graduated_scorer(cfg: dict) -> Scorer:
    """Build a graduated scorer (0-100) from YAML config."""
    genres_cfg = cfg.get("genres", {})
    primary = tuple(genres_cfg.get("primary", []))
    artist_score = genres_cfg.get("artist_score", 75)
    album_score = genres_cfg.get("album_score", 60)

    sub_cfg = cfg.get("subgenres", {})
    subgenre_keywords = tuple(sub_cfg.get("keywords", []))
    subgenre_bonus = sub_cfg.get("bonus", 10)

    audio_boosts = cfg.get("audio_boosts", [])
    tempo_ranges = cfg.get("tempo", [])

    def score(data: TrackData) -> int:
        genres = data["artist_genres"]
        album_genres = data["album_genres"]
        af = data["audio_features"]
        s = 0

        # Primary genre match
        if primary:
            if _genre_contains(genres, *primary):
                s = artist_score
            elif _genre_contains(album_genres, *primary):
                s = album_score

        # Subgenre bonus
        if subgenre_keywords and _genre_contains(genres + album_genres, *subgenre_keywords):
            s += subgenre_bonus

        # Audio feature boosts
        for boost in audio_boosts:
            val = af.get(boost["feature"], 0)
            if boost.get("invert"):
                val = 1 - val
            s += int(boost["weight"] * val)

        # Tempo ranges
        tempo = af.get("tempo", 0)
        for tr in tempo_ranges:
            t_min = tr.get("min", 0)
            t_max = tr.get("max", float("inf"))
            if t_min <= tempo <= t_max:
                s += tr["bonus"]
                break  # only one tempo range should match

        return s

    return score


_METRICS_DIR = Path(__file__).resolve().parent.parent / "metrics"


def _load_metrics_from_yaml():
    """Load metric definitions from metrics/*.yml and register them."""
    if not _METRICS_DIR.is_dir():
        return

    for yml_path in sorted(_METRICS_DIR.glob("*.yml")):
        name = yml_path.stem
        if name in SCORERS:
            continue  # don't override custom @scorer definitions

        with open(yml_path) as f:
            cfg = yaml.safe_load(f)

        metric_type = cfg.get("type", "graduated")
        color = cfg.get("color", "#1DB954")
        METRIC_CONFIGS[name] = {"color": color, "type": metric_type}
        if metric_type == "binary":
            SCORERS[name] = _build_binary_scorer(cfg)
        else:
            SCORERS[name] = _build_graduated_scorer(cfg)


_load_metrics_from_yaml()


# ---------------------------------------------------------------------------
# Full config access (for refine tools)
# ---------------------------------------------------------------------------

def get_metric_full_configs() -> dict[str, dict]:
    """Return full YAML config for all metrics."""
    configs: dict[str, dict] = {}
    if _METRICS_DIR.is_dir():
        for yml_path in sorted(_METRICS_DIR.glob("*.yml")):
            with open(yml_path) as f:
                configs[yml_path.stem] = yaml.safe_load(f)
    return configs


def score_track_with_breakdown(track: dict, metric_name: str) -> dict:
    """Score a track against a single metric, returning a detailed breakdown."""
    configs = get_metric_full_configs()
    cfg = configs.get(metric_name)
    if not cfg:
        return {"score": 0, "base_score": 0, "base_reason": None, "matched_genres": [],
                "subgenre_bonus": 0, "audio_boosts": [], "tempo_bonus": 0, "tempo": 0}

    data = TrackData(
        track=track,
        artist_genres=[g.lower() for g in track.get("_artist_genres", [])],
        album_genres=[g.lower() for g in track.get("_album_genres", [])],
        audio_features=track.get("_audio_features", {}),
    )
    metric_type = cfg.get("type", "graduated")

    if metric_type == "binary":
        return _score_binary_with_breakdown(cfg, data)

    # Graduated scoring with breakdown
    genres_cfg = cfg.get("genres", {})
    primary = tuple(genres_cfg.get("primary", []))
    artist_score_val = genres_cfg.get("artist_score", 75)
    album_score_val = genres_cfg.get("album_score", 60)

    sub_cfg = cfg.get("subgenres", {})
    subgenre_keywords = tuple(sub_cfg.get("keywords", []))
    subgenre_bonus_val = sub_cfg.get("bonus", 10)

    audio_boosts_cfg = cfg.get("audio_boosts", [])
    tempo_ranges = cfg.get("tempo", [])
    af = data["audio_features"]

    base_score = 0
    base_reason = None
    matched_genres: list[str] = []

    if primary:
        matched_primary = [g for g in data["artist_genres"] if any(kw in g for kw in primary)]
        matched_album = [g for g in data["album_genres"] if any(kw in g for kw in primary)]
        if matched_primary:
            base_score = artist_score_val
            base_reason = "artist_genre_match"
            matched_genres.extend(matched_primary)
        elif matched_album:
            base_score = album_score_val
            base_reason = "album_genre_match"
            matched_genres.extend(matched_album)

    subgenre_bonus = 0
    if subgenre_keywords:
        all_genres = data["artist_genres"] + data["album_genres"]
        matched_sub = [g for g in all_genres if any(kw in g for kw in subgenre_keywords)]
        if matched_sub:
            subgenre_bonus = subgenre_bonus_val
            matched_genres.extend(matched_sub)

    matched_genres = list(dict.fromkeys(matched_genres))

    audio_boost_details = []
    for boost in audio_boosts_cfg:
        val = af.get(boost["feature"], 0)
        effective = 1 - val if boost.get("invert") else val
        contribution = int(boost["weight"] * effective)
        audio_boost_details.append({
            "feature": boost["feature"],
            "value": round(val, 3),
            "contribution": contribution,
        })

    tempo_bonus = 0
    tempo = af.get("tempo", 0)
    for tr in tempo_ranges:
        t_min = tr.get("min", 0)
        t_max = tr.get("max", float("inf"))
        if t_min <= tempo <= t_max:
            tempo_bonus = tr["bonus"]
            break

    total = base_score + subgenre_bonus + sum(b["contribution"] for b in audio_boost_details) + tempo_bonus
    total = max(0, min(100, total))

    return {
        "score": total,
        "base_score": base_score,
        "base_reason": base_reason,
        "matched_genres": matched_genres,
        "subgenre_bonus": subgenre_bonus,
        "audio_boosts": audio_boost_details,
        "tempo_bonus": tempo_bonus,
        "tempo": round(tempo, 1),
    }


def _score_binary_with_breakdown(cfg: dict, data: TrackData) -> dict:
    """Breakdown for binary scorers."""
    pattern = re.compile(cfg["text_regex"]) if "text_regex" in cfg else None
    keywords = tuple(cfg.get("genre_keywords", []))

    base_reason = None
    matched: list[str] = []

    if pattern and _text_matches(data["track"], pattern):
        base_reason = "text_match"
    elif keywords:
        for kw in keywords:
            if _genre_contains(data["artist_genres"], kw) or _genre_contains(data["album_genres"], kw):
                base_reason = "genre_keyword_match"
                matched.append(kw)

    score = 100 if base_reason else 0
    return {
        "score": score,
        "base_score": score,
        "base_reason": base_reason,
        "matched_genres": matched,
        "subgenre_bonus": 0,
        "audio_boosts": [],
        "tempo_bonus": 0,
        "tempo": data["audio_features"].get("tempo", 0),
    }
