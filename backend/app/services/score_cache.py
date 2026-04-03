"""Persistent cache for track scores. Stored as JSON file.

Automatically invalidates when scorers change (names or logic)."""

from __future__ import annotations

import hashlib
import inspect
import json
from pathlib import Path

from app.services.scoring import get_scorer_names, SCORERS

_CACHE_FILE = Path(__file__).resolve().parent.parent / "_score_cache.json"
_cache: dict[str, dict[str, int]] = {}


def _scorer_fingerprint() -> str:
    """Hash of all scorer names + source code. Changes when any scorer is added/removed/modified."""
    h = hashlib.md5()
    for name in sorted(SCORERS.keys()):
        h.update(name.encode())
        h.update(inspect.getsource(SCORERS[name]).encode())
    return h.hexdigest()


def _load():
    global _cache
    if not _CACHE_FILE.exists():
        return

    try:
        raw = json.loads(_CACHE_FILE.read_text())
    except Exception:
        _cache = {}
        return

    # Cache format: {"_fingerprint": "...", "scores": {track_id: {name: score}}}
    if raw.get("_fingerprint") != _scorer_fingerprint():
        _cache = {}
        _CACHE_FILE.unlink(missing_ok=True)
        return

    _cache = raw.get("scores", {})


def _save():
    try:
        data = {
            "_fingerprint": _scorer_fingerprint(),
            "scores": _cache,
        }
        _CACHE_FILE.write_text(json.dumps(data))
    except Exception:
        pass


# Load on import
_load()


def get_cached_scores(track_id: str) -> dict[str, int] | None:
    return _cache.get(track_id)


def set_cached_scores(track_id: str, scores: dict[str, int]) -> None:
    _cache[track_id] = scores
    _save()


def set_cached_scores_bulk(entries: dict[str, dict[str, int]]) -> None:
    _cache.update(entries)
    _save()
