"""Batch-fetch artist genres and audio features for tracks.

Uses Spotify API for artist/album genres, ReccoBeats API for audio features
(free replacement for Spotify's deprecated audio features endpoint).
"""

from __future__ import annotations
from app.services.spotify import spotify_request
from app.services.reccobeats import fetch_audio_features


def _chunk(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


async def fetch_artist_genres(session_id: str, artist_ids: list[str]) -> dict[str, list[str]]:
    """Fetch genres for artists in batches of 50. Returns {artist_id: [genres]}."""
    result: dict[str, list[str]] = {}
    for batch in _chunk(artist_ids, 50):
        ids_param = ",".join(batch)
        resp = await spotify_request(session_id, "GET", f"/artists?ids={ids_param}")
        if resp.status_code != 200:
            continue
        for artist in resp.json().get("artists", []):
            if artist:
                result[artist["id"]] = artist.get("genres", [])
    return result


async def fetch_album_artists_genres(session_id: str, album_ids: list[str]) -> dict[str, list[str]]:
    """Fetch genres for all artists on albums. Returns {album_id: [all_artist_genres]}."""
    result: dict[str, list[str]] = {}
    for batch in _chunk(album_ids, 20):
        for album_id in batch:
            resp = await spotify_request(session_id, "GET", f"/albums/{album_id}")
            if resp.status_code != 200:
                continue
            album = resp.json()
            artist_ids = [a["id"] for a in album.get("artists", [])]
            for t in album.get("tracks", {}).get("items", []):
                for a in t.get("artists", []):
                    if a.get("id") and a["id"] not in artist_ids:
                        artist_ids.append(a["id"])
            genres = await fetch_artist_genres(session_id, artist_ids)
            all_genres: list[str] = []
            for g in genres.values():
                all_genres.extend(g)
            result[album_id] = list(set(all_genres))
    return result


async def enrich_tracks(session_id: str, tracks: list[dict]) -> list[dict]:
    """Enrich tracks with artist genres, album-level genres, and audio features.

    Adds `_artist_genres`, `_album_genres`, and `_audio_features` keys to each track dict.
    """
    # Collect unique IDs
    artist_ids = list({a["id"] for t in tracks for a in t.get("artists", []) if a.get("id")})
    album_ids = list({t["album"]["id"] for t in tracks if t.get("album", {}).get("id")})
    track_ids = [t["id"] for t in tracks if t.get("id")]

    # Batch fetch
    genre_map = await fetch_artist_genres(session_id, artist_ids)
    album_genre_map = await fetch_album_artists_genres(session_id, album_ids)
    audio_map = await fetch_audio_features(track_ids)

    # Attach to tracks
    for track in tracks:
        all_genres: list[str] = []
        for artist in track.get("artists", []):
            all_genres.extend(genre_map.get(artist["id"], []))
        track["_artist_genres"] = all_genres

        album_id = track.get("album", {}).get("id", "")
        track["_album_genres"] = album_genre_map.get(album_id, [])

        track["_audio_features"] = audio_map.get(track["id"], {})

    return tracks
