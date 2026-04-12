from __future__ import annotations

import random
from dataclasses import dataclass, field

DEFAULT_QUEUE_SIZE = 10


@dataclass
class QueueState:
    tracks: list[dict] = field(default_factory=list)
    all_tracks: list[dict] = field(default_factory=list)
    current_index: int = -1
    played: set[str] = field(default_factory=set)
    last_weights: dict[str, int] = field(default_factory=dict)
    queue_size: int = DEFAULT_QUEUE_SIZE
    sources: set[str] = field(default_factory=set)  # e.g. "liked", "playlist:xxx", "album:xxx"
    track_sources: dict[str, str] = field(default_factory=dict)  # track_id -> source_key

    @property
    def current_track(self) -> dict | None:
        if 0 <= self.current_index < len(self.tracks):
            return self.tracks[self.current_index]
        return None

    @property
    def has_next(self) -> bool:
        return self.current_index < len(self.tracks) - 1

    @property
    def has_previous(self) -> bool:
        return self.current_index > 0

    def _mark_played(self) -> None:
        """Mark the current track as played."""
        track = self.current_track
        if track:
            self.played.add(track["id"])

    def add_tracks(self, tracks: list[dict], source_key: str = "") -> None:
        """Merge tracks into the full library (deduplicate by ID)."""
        existing_ids = {t["id"] for t in self.all_tracks}
        for t in tracks:
            if t["id"] not in existing_ids:
                self.all_tracks.append(t)
                existing_ids.add(t["id"])
                if source_key:
                    self.track_sources[t["id"]] = source_key

    def remove_source(self, source_key: str) -> None:
        """Remove all tracks from a source and rebuild the queue."""
        if source_key not in self.sources:
            return
        # Find track IDs belonging to this source
        ids_to_remove = {tid for tid, src in self.track_sources.items() if src == source_key}
        # Remove from all_tracks
        self.all_tracks = [t for t in self.all_tracks if t["id"] not in ids_to_remove]
        # Remove from current queue
        current_id = self.current_track["id"] if self.current_track else None
        self.tracks = [t for t in self.tracks if t["id"] not in ids_to_remove]
        # Fix current_index
        if current_id and current_id in ids_to_remove:
            self.current_index = 0 if self.tracks else -1
        elif current_id:
            self.current_index = next((i for i, t in enumerate(self.tracks) if t["id"] == current_id), 0)
        # Clean up
        self.sources.discard(source_key)
        for tid in ids_to_remove:
            self.track_sources.pop(tid, None)
            self.played.discard(tid)
        # Refill queue
        self._refill()

    def rerank(self, weights: dict[str, int]) -> None:
        """Recompute the queue based on metric weights using proportional selection.

        Each active metric gets a share of the queue proportional to its weight.
        E.g. hebrew=50, non_english=50 with queue_size=10 → ~5 top hebrew, ~5 top non_english.
        Songs are picked by their individual metric score (not weighted average).
        """
        if not any(w > 0 for w in weights.values()):
            if not self.tracks:
                available = [t for t in self.all_tracks if t["id"] not in self.played]
                self.tracks = available[: self.queue_size]
                self.current_index = 0 if self.tracks else -1
            return

        self.last_weights = weights

        # Preserve the currently playing track
        current_id = self.current_track["id"] if self.current_track else None

        available = [t for t in self.all_tracks if t["id"] not in self.played]
        if current_id:
            available = [t for t in available if t["id"] != current_id]

        # Weights are out of 100 — the unfilled portion is "general" (random songs)
        # E.g. hebrew=10 means 10% hebrew, 90% random from full library
        active_weights = {k: v for k, v in weights.items() if v > 0}
        slots_needed = self.queue_size - (1 if current_id else 0)

        # Allocate metric slots proportionally to their weight (out of 100, not out of total)
        slot_alloc: dict[str, int] = {}
        allocated = 0
        for name, w in active_weights.items():
            n = round(slots_needed * w / 100)
            slot_alloc[name] = n
            allocated += n

        # General slots = remainder
        general_slots = max(0, slots_needed - allocated)

        # Pick top songs per metric (only tracks that actually score > 0)
        picked_ids: set[str] = set()
        result: list[dict] = []

        for metric_name, num_slots in slot_alloc.items():
            candidates = [
                t for t in available if t["id"] not in picked_ids and t.get("_scores", {}).get(metric_name, 0) > 0
            ]
            candidates.sort(key=lambda t: t["_scores"][metric_name], reverse=True)
            # Shuffle among ties to keep variety
            random.shuffle(candidates)
            candidates.sort(key=lambda t: t["_scores"][metric_name], reverse=True)
            for track in candidates[:num_slots]:
                result.append(track)
                picked_ids.add(track["id"])

        # Fill general slots with random songs from the remaining pool
        if general_slots > 0:
            remaining = [t for t in available if t["id"] not in picked_ids]
            random.shuffle(remaining)
            for t in remaining[:general_slots]:
                result.append(t)
                picked_ids.add(t["id"])

        # Shuffle the result so metrics are interleaved, not grouped
        random.shuffle(result)

        # Keep current track at index 0
        if current_id and self.current_track:
            result.insert(0, self.current_track)

        self.tracks = result[: self.queue_size]
        self.current_index = 0 if self.tracks else -1

    def _refill(self) -> None:
        """Top up the queue to self.queue_size by appending songs respecting metric proportions."""
        if not self.all_tracks or len(self.tracks) >= self.queue_size:
            return

        current_ids = {t["id"] for t in self.tracks}
        excluded = self.played | current_ids
        available = [t for t in self.all_tracks if t["id"] not in excluded]
        needed = self.queue_size - len(self.tracks)

        if not available:
            return

        weights = self.last_weights
        if weights and any(w > 0 for w in weights.values()):
            active = {k: v for k, v in weights.items() if v > 0}

            # Allocate refill slots the same way as rerank
            slot_alloc: dict[str, int] = {}
            allocated = 0
            for name, w in active.items():
                n = round(needed * w / 100)
                slot_alloc[name] = n
                allocated += n
            general_slots = max(0, needed - allocated)

            added: list[dict] = []
            used_ids: set[str] = set()

            for metric_name, num_slots in slot_alloc.items():
                candidates = [
                    t for t in available if t["id"] not in used_ids and t.get("_scores", {}).get(metric_name, 0) > 0
                ]
                random.shuffle(candidates)
                candidates.sort(key=lambda t: t["_scores"][metric_name], reverse=True)
                for track in candidates[:num_slots]:
                    added.append(track)
                    used_ids.add(track["id"])

            if general_slots > 0:
                remaining = [t for t in available if t["id"] not in used_ids]
                random.shuffle(remaining)
                for t in remaining[:general_slots]:
                    added.append(t)
                    used_ids.add(t["id"])

            random.shuffle(added)
            self.tracks.extend(added[:needed])
        else:
            random.shuffle(available)
            self.tracks.extend(available[:needed])

    def sync_current_track(self, playing_id: str) -> None:
        """If the given track ID is in the library, move it to the front of the queue."""
        # Check if it's already at the front
        if self.tracks and self.tracks[0]["id"] == playing_id:
            return
        # Find in current queue and move to front
        for i, t in enumerate(self.tracks):
            if t["id"] == playing_id:
                self.tracks.insert(0, self.tracks.pop(i))
                self.current_index = 0
                return
        # Not in queue but in library — insert at front
        for t in self.all_tracks:
            if t["id"] == playing_id:
                self.tracks.insert(0, t)
                if len(self.tracks) > self.queue_size:
                    self.tracks = self.tracks[: self.queue_size]
                self.current_index = 0
                return

    def skip(self) -> dict | None:
        """Remove current (first) song, advance to next, refill to keep self.queue_size."""
        if not self.tracks:
            return None
        self.played.add(self.tracks[0]["id"])
        self.tracks.pop(0)
        self.current_index = 0
        self._refill()
        return self.current_track

    def previous(self) -> dict | None:
        # Previous not applicable in this model — queue always moves forward
        return None

    def jump(self, index: int) -> dict | None:
        """Jump to a track: remove everything before it, refill to keep self.queue_size."""
        if index < 0 or index >= len(self.tracks):
            return None
        # Mark all songs before the target as played
        for i in range(index):
            self.played.add(self.tracks[i]["id"])
        self.tracks = self.tracks[index:]
        self.current_index = 0
        self._refill()
        return self.current_track

    def shuffle(self) -> None:
        if self.current_index < 0 or self.current_index >= len(self.tracks) - 1:
            return
        remaining = self.tracks[self.current_index + 1 :]
        random.shuffle(remaining)
        self.tracks[self.current_index + 1 :] = remaining

    def remove_track(self, index: int) -> dict | None:
        if index < 0 or index >= len(self.tracks):
            return None
        removed = self.tracks.pop(index)
        if index < self.current_index:
            self.current_index -= 1
        elif index == self.current_index and self.current_index >= len(self.tracks):
            self.current_index = max(len(self.tracks) - 1, -1)
        return removed

    def clear(self) -> None:
        self.tracks.clear()
        self.all_tracks.clear()
        self.current_index = -1
        self.played.clear()
        self.last_weights.clear()
        self.sources.clear()
        self.track_sources.clear()

    def to_dict(self) -> dict:
        return {
            "tracks": self.tracks,
            "current_index": self.current_index,
            "current_track": self.current_track,
            "sources": list(self.sources),
        }


# Per-session queue store
queues: dict[str, QueueState] = {}


def get_queue(session_id: str) -> QueueState:
    if session_id not in queues:
        queues[session_id] = QueueState()
    return queues[session_id]
