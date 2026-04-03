"""Fetch audio features from ReccoBeats API (free, no auth needed).

Accepts Spotify track IDs directly. Batch endpoint supports up to 40 IDs per request.
"""

from __future__ import annotations
from typing import Callable
import httpx

RECCOBEATS_BASE = "https://api.reccobeats.com"


def _chunk(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


async def fetch_audio_features(
    track_ids: list[str],
    on_progress: Callable[[str, int, int], None] | None = None,
) -> dict[str, dict]:
    """Fetch audio features for Spotify track IDs via ReccoBeats.

    Returns {spotify_track_id: {acousticness, danceability, energy, ...}}.
    """
    result: dict[str, dict] = {}
    total = len(track_ids)

    for i, batch in enumerate(_chunk(track_ids, 40)):
        ids_param = ",".join(batch)
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{RECCOBEATS_BASE}/v1/audio-features",
                    params={"ids": ids_param},
                    timeout=15,
                )
            if resp.status_code != 200:
                continue
            data = resp.json()
            for item in data.get("content", []):
                if not item:
                    continue
                # Extract Spotify track ID from the href
                href = item.get("href", "")
                spotify_id = href.split("/")[-1] if "spotify.com/track/" in href else None
                if spotify_id:
                    result[spotify_id] = {
                        "acousticness": item.get("acousticness", 0),
                        "danceability": item.get("danceability", 0),
                        "energy": item.get("energy", 0),
                        "instrumentalness": item.get("instrumentalness", 0),
                        "liveness": item.get("liveness", 0),
                        "loudness": item.get("loudness", 0),
                        "speechiness": item.get("speechiness", 0),
                        "tempo": item.get("tempo", 0),
                        "valence": item.get("valence", 0),
                    }
        except Exception:
            continue
        if on_progress:
            on_progress("audio", min((i + 1) * 40, total), total)

    return result
