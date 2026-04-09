"""Persistent cache for track scores. Stored as JSON file.

Each metric has its own fingerprint based on its YAML content.
When a metric YAML changes, only that metric's cached scores are invalidated."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from app.services.scoring import SCORERS

_CACHE_FILE = Path(__file__).resolve().parent.parent / "_score_cache.json"
_METRICS_DIR = Path(__file__).resolve().parent.parent / "metrics"

# Cache structure: {track_id: {metric_name: score}}
_cache: dict[str, dict[str, int]] = {}
# Per-metric fingerprints at load time
_loaded_fingerprints: dict[str, str] = {}


def _metric_fingerprint(metric_name: str) -> str:
    """Hash a single metric's YAML content."""
    yml_path = _METRICS_DIR / f"{metric_name}.yml"
    if yml_path.exists():
        return hashlib.md5(yml_path.read_bytes()).hexdigest()
    return ""


def _all_metric_fingerprints() -> dict[str, str]:
    """Return {metric_name: fingerprint} for all current metrics."""
    fps: dict[str, str] = {}
    if _METRICS_DIR.is_dir():
        for yml_path in sorted(_METRICS_DIR.glob("*.yml")):
            name = yml_path.stem
            fps[name] = hashlib.md5(yml_path.read_bytes()).hexdigest()
    return fps


def _load():
    global _cache, _loaded_fingerprints
    if not _CACHE_FILE.exists():
        return

    try:
        raw = json.loads(_CACHE_FILE.read_text())
    except Exception:
        _cache = {}
        return

    saved_fps = raw.get("_fingerprints", {})
    current_fps = _all_metric_fingerprints()
    _loaded_fingerprints = current_fps

    # Find which metrics changed
    changed_metrics = set()
    for name in set(list(saved_fps.keys()) + list(current_fps.keys())):
        if saved_fps.get(name) != current_fps.get(name):
            changed_metrics.add(name)

    scores = raw.get("scores", {})

    if not changed_metrics:
        _cache = scores
        return

    # Strip changed metrics from cached scores
    for track_id, track_scores in scores.items():
        _cache[track_id] = {m: s for m, s in track_scores.items() if m not in changed_metrics}


def _save():
    try:
        data = {
            "_fingerprints": _all_metric_fingerprints(),
            "scores": _cache,
        }
        _CACHE_FILE.write_text(json.dumps(data))
    except Exception:
        pass


# Load on import
_load()


def get_cached_scores(track_id: str) -> dict[str, int] | None:
    cached = _cache.get(track_id)
    if not cached:
        return None
    # Only return if we have scores for ALL current scorers
    if set(SCORERS.keys()) - set(cached.keys()):
        return None
    return cached


def set_cached_scores(track_id: str, scores: dict[str, int]) -> None:
    _cache[track_id] = scores
    _save()


def set_cached_scores_bulk(entries: dict[str, dict[str, int]]) -> None:
    _cache.update(entries)
    _save()
