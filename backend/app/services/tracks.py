"""Shared track fetching from Spotify sources."""

from app.services.spotify import spotify_request


async def fetch_tracks_for_source(
    session_id: str, source: str, playlist_id: str | None, album_id: str | None
) -> tuple[str, list[dict]]:
    """Fetch tracks for a given source. Returns (source_key, tracks)."""
    tracks: list[dict] = []

    if source == "liked":
        offset = 0
        while True:
            resp = await spotify_request(session_id, "GET", f"/me/tracks?offset={offset}&limit=50")
            if resp.status_code != 200:
                break
            data = resp.json()
            items = data.get("items", [])
            if not items:
                break
            tracks.extend(item["track"] for item in items if item.get("track"))
            offset += 50
            if offset >= data.get("total", 0):
                break
        return "liked", tracks

    elif source == "playlist" and playlist_id:
        offset = 0
        while True:
            url = f"/playlists/{playlist_id}/tracks?offset={offset}&limit=100"
            resp = await spotify_request(session_id, "GET", url)
            if resp.status_code != 200:
                break
            data = resp.json()
            items = data.get("items", [])
            if not items:
                break
            tracks.extend(item["track"] for item in items if item.get("track") and item["track"].get("id"))
            offset += 100
            if offset >= data.get("total", 0):
                break
        return f"playlist:{playlist_id}", tracks

    elif source == "album" and album_id:
        resp = await spotify_request(session_id, "GET", f"/albums/{album_id}")
        if resp.status_code == 200:
            album_data = resp.json()
            track_ids = [item["id"] for item in album_data.get("tracks", {}).get("items", []) if item.get("id")]
            for i in range(0, len(track_ids), 50):
                batch = track_ids[i : i + 50]
                ids_param = ",".join(batch)
                tresp = await spotify_request(session_id, "GET", f"/tracks?ids={ids_param}")
                if tresp.status_code == 200:
                    for t in tresp.json().get("tracks", []):
                        if t and t.get("id"):
                            tracks.append(t)
        return f"album:{album_id}", tracks

    return "", []
