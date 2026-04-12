"""In-memory suggestion pool for song requests."""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field


@dataclass
class Suggestion:
    track: dict
    count: int = 1
    first_requested: float = field(default_factory=time.time)
    last_requested: float = field(default_factory=time.time)


@dataclass
class SuggestionPool:
    enabled: bool = False
    code: str = ""
    dj_session_id: str = ""
    suggestions: dict[str, Suggestion] = field(default_factory=dict)

    def submit(self, track_id: str, track: dict) -> Suggestion:
        if track_id in self.suggestions:
            s = self.suggestions[track_id]
            s.count += 1
            s.last_requested = time.time()
            return s
        s = Suggestion(track=track)
        self.suggestions[track_id] = s
        return s

    def unvote(self, track_id: str) -> int:
        """Remove one vote. Returns new count, or -1 if not found."""
        s = self.suggestions.get(track_id)
        if not s:
            return -1
        s.count = max(0, s.count - 1)
        if s.count == 0:
            del self.suggestions[track_id]
            return 0
        return s.count

    def dismiss(self, track_id: str) -> bool:
        return self.suggestions.pop(track_id, None) is not None

    def accept(self, track_id: str) -> dict | None:
        s = self.suggestions.pop(track_id, None)
        return s.track if s else None

    def list_sorted(self) -> list[dict]:
        items = []
        for track_id, s in self.suggestions.items():
            items.append(
                {
                    "track_id": track_id,
                    "track": s.track,
                    "count": s.count,
                    "first_requested": s.first_requested,
                    "last_requested": s.last_requested,
                }
            )
        items.sort(key=lambda x: (-x["count"], -x["last_requested"]))
        return items


# Per-session pools
_pools: dict[str, SuggestionPool] = {}

# Code -> session_id lookup
_code_to_session: dict[str, str] = {}


def get_pool(session_id: str) -> SuggestionPool:
    if session_id not in _pools:
        _pools[session_id] = SuggestionPool()
    return _pools[session_id]


def get_pool_by_code(code: str) -> SuggestionPool | None:
    session_id = _code_to_session.get(code)
    if not session_id:
        return None
    pool = _pools.get(session_id)
    if pool and pool.enabled and pool.code == code:
        return pool
    return None


def enable_pool(session_id: str) -> SuggestionPool:
    pool = get_pool(session_id)
    if pool.enabled:
        return pool
    pool.enabled = True
    pool.code = secrets.token_urlsafe(8)
    pool.dj_session_id = session_id
    pool.suggestions.clear()
    _code_to_session[pool.code] = session_id
    return pool


def disable_pool(session_id: str) -> SuggestionPool:
    pool = get_pool(session_id)
    if pool.code in _code_to_session:
        del _code_to_session[pool.code]
    pool.enabled = False
    pool.code = ""
    pool.suggestions.clear()
    return pool
