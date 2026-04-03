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
from pathlib import Path
from typing import Callable, TypedDict

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
