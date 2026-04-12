import json

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.metadata import attach_enrichment, enrich_artist_genres, enrich_audio_features
from app.services.queue import get_queue, mark_dirty
from app.services.score_cache import get_cached_scores, set_cached_scores_bulk
from app.services.scoring import get_metric_configs, score_track
from app.services.spotify import sessions, spotify_request
from app.services.tracks import fetch_tracks_for_source

router = APIRouter()


def get_session_id(request: Request) -> str | None:
    session_id = request.cookies.get("session_id")
    if session_id and session_id in sessions:
        return session_id
    return None


async def _get_active_device(session_id: str) -> str | None:
    """Get an active Spotify device ID, or the first available one."""
    resp = await spotify_request(session_id, "GET", "/me/player/devices")
    if resp.status_code != 200:
        return None
    devices = resp.json().get("devices", [])
    # Prefer the active device, fall back to first available
    for d in devices:
        if d.get("is_active"):
            return d["id"]
    return devices[0]["id"] if devices else None


async def _play_track(session_id: str, track_uri: str) -> None:
    """Tell Spotify to play a specific track."""
    device_id = await _get_active_device(session_id)
    params = f"?device_id={device_id}" if device_id else ""
    await spotify_request(
        session_id,
        "PUT",
        f"/me/player/play{params}",
        json={"uris": [track_uri]},
    )


class AddTracksBody(BaseModel):
    source: str = "liked"  # "liked", "playlist", "album"
    playlist_id: str | None = None
    album_id: str | None = None


class SyncCurrentBody(BaseModel):
    track_id: str


class QueueSizeBody(BaseModel):
    size: int


@router.get("")
async def get_queue_state(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    q = get_queue(session_id)
    return q.to_dict()


@router.get("/snapshot")
async def get_queue_snapshot(request: Request):
    """Return a lightweight summary for the resume prompt."""
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    q = get_queue(session_id)
    return q.snapshot()


@router.get("/stats")
async def get_queue_stats(request: Request):
    """Return score distributions for all unplayed tracks."""
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    q = get_queue(session_id)

    unplayed = [t for t in q.all_tracks if t["id"] not in q.played]
    # Collect distributions: {metric: {bucket_label: count}}
    buckets = [
        ("0", 0, 0),
        ("1-19", 1, 19),
        ("20-39", 20, 39),
        ("40-59", 40, 59),
        ("60-79", 60, 79),
        ("80-100", 80, 100),
    ]
    metrics: dict[str, dict] = {}
    for t in unplayed:
        scores = t.get("_scores", {})
        for name, score in scores.items():
            if name not in metrics:
                metrics[name] = {b[0]: 0 for b in buckets}
            for label, lo, hi in buckets:
                if lo <= score <= hi:
                    metrics[name][label] += 1
                    break

    return {"total": len(unplayed), "metrics": metrics}


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.post("/add")
async def add_to_queue(request: Request, body: AddTracksBody):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)

    async def generate():
        yield _sse_event({"step": "fetching", "progress": 0, "total": 0, "message": "Fetching tracks..."})

        source_key, tracks = await fetch_tracks_for_source(session_id, body.source, body.playlist_id, body.album_id)

        total = len(tracks)
        yield _sse_event({"step": "fetching", "progress": total, "total": total, "message": f"Fetched {total} tracks"})

        if not tracks:
            yield _sse_event({"step": "error", "message": "No tracks found"})
            return

        if source_key in q.sources:
            yield _sse_event({"step": "done", "message": "Already loaded"})
            return

        # Check cache, only enrich+score uncached tracks
        cached_tracks: list[dict] = []
        uncached_tracks: list[dict] = []
        for track in tracks:
            cached = get_cached_scores(track["id"])
            if cached is not None:
                track["_scores"] = cached
                cached_tracks.append(track)
            else:
                uncached_tracks.append(track)

        if uncached_tracks:
            yield _sse_event({"step": "enriching", "progress": 0, "total": 2, "message": "Fetching artist genres..."})
            genre_map = await enrich_artist_genres(session_id, uncached_tracks)

            yield _sse_event({"step": "enriching", "progress": 1, "total": 2, "message": "Fetching audio features..."})
            audio_map = await enrich_audio_features(uncached_tracks)

            uncached_tracks = attach_enrichment(uncached_tracks, genre_map, {}, audio_map)

            msg = f"Scoring tracks... 0/{total}"
            yield _sse_event({"step": "scoring", "progress": 0, "total": total, "message": msg})
            new_scores: dict[str, dict[str, int]] = {}
            scored_count = len(cached_tracks)
            for i, track in enumerate(uncached_tracks):
                scores = score_track(track)
                track["_scores"] = scores
                new_scores[track["id"]] = scores
                scored_count += 1
                if (i + 1) % 20 == 0 or i == len(uncached_tracks) - 1:
                    msg = f"Scoring tracks... {scored_count}/{total}"
                    yield _sse_event({"step": "scoring", "progress": scored_count, "total": total, "message": msg})
            set_cached_scores_bulk(new_scores)
        else:
            msg = f"Loaded {total} tracks from cache"
            yield _sse_event({"step": "scoring", "progress": total, "total": total, "message": msg})

        all_tracks = cached_tracks + uncached_tracks

        was_empty = len(q.all_tracks) == 0
        q.add_tracks(all_tracks, source_key)
        q.sources.add(source_key)

        if was_empty:
            q.rerank({})
            # If Spotify has a track loaded, put it at the front of the queue
            playback = await spotify_request(session_id, "GET", "/me/player")
            if playback.status_code == 200:
                pb = playback.json()
                playing_item = pb.get("item")
                if playing_item and playing_item.get("id"):
                    playing_id = playing_item["id"]
                    q.sync_current_track(playing_id)
                    # If track wasn't in the library, enrich, score, and insert it
                    if not q.tracks or q.tracks[0]["id"] != playing_id:
                        cached = get_cached_scores(playing_id)
                        if cached:
                            playing_item["_scores"] = cached
                        else:
                            genre_map = await enrich_artist_genres(session_id, [playing_item])
                            audio_map = await enrich_audio_features([playing_item])
                            [playing_item] = attach_enrichment([playing_item], genre_map, {}, audio_map)
                            playing_item["_scores"] = score_track(playing_item)
                            set_cached_scores_bulk({playing_id: playing_item["_scores"]})
                        q.tracks.insert(0, playing_item)
                        if len(q.tracks) > q.queue_size:
                            q.tracks = q.tracks[: q.queue_size]
                        q.current_index = 0
        else:
            q._refill()

        mark_dirty()
        yield _sse_event({"step": "done", "message": f"Added {total} tracks", "queue": q.to_dict()})

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/rescore")
async def rescore(request: Request):
    """Re-score all tracks in the queue with current metric configs."""
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    if not q.all_tracks:
        return Response(status_code=400, content="No library loaded")

    # Re-score every track and update cache
    new_scores: dict[str, dict[str, int]] = {}
    for track in q.all_tracks:
        scores = score_track(track)
        track["_scores"] = scores
        new_scores[track["id"]] = scores

    # Also update tracks in the active queue
    all_by_id = {t["id"]: t for t in q.all_tracks}
    for i, track in enumerate(q.tracks):
        if track["id"] in all_by_id:
            q.tracks[i] = all_by_id[track["id"]]

    set_cached_scores_bulk(new_scores)
    mark_dirty()
    return q.to_dict()


@router.post("/sync-current")
async def sync_current(request: Request, body: SyncCurrentBody):
    """Sync the queue's current track with what Spotify is actually playing."""
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    track_id = body.track_id

    # Already at front — nothing to do
    if q.tracks and q.tracks[0]["id"] == track_id:
        return q.to_dict()

    # Try to find in queue or library and move to front
    q.sync_current_track(track_id)
    if q.tracks and q.tracks[0]["id"] == track_id:
        return q.to_dict()

    # Not in library — fetch from Spotify, enrich, score, insert
    resp = await spotify_request(session_id, "GET", f"/tracks/{track_id}")
    if resp.status_code != 200:
        return Response(status_code=404, content="Track not found")
    track = resp.json()

    cached = get_cached_scores(track_id)
    if cached:
        track["_scores"] = cached
    else:
        genre_map = await enrich_artist_genres(session_id, [track])
        audio_map = await enrich_audio_features([track])
        [track] = attach_enrichment([track], genre_map, {}, audio_map)
        track["_scores"] = score_track(track)
        set_cached_scores_bulk({track_id: track["_scores"]})

    q.tracks.insert(0, track)
    if len(q.tracks) > q.queue_size:
        q.tracks = q.tracks[: q.queue_size]
    q.current_index = 0
    mark_dirty()
    return q.to_dict()


class RerankBody(BaseModel):
    weights: dict[str, int]


@router.post("/rerank")
async def rerank(request: Request, body: RerankBody):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    if not q.all_tracks:
        return Response(status_code=400, content="No library loaded")

    q.rerank(body.weights)
    mark_dirty()
    return q.to_dict()


@router.get("/scorers")
async def list_scorers():
    """Return all available metrics with their config (color, type)."""
    return get_metric_configs()


class RemoveSourceBody(BaseModel):
    source_key: str


@router.post("/remove-source")
async def remove_source(request: Request, body: RemoveSourceBody):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    q.remove_source(body.source_key)
    mark_dirty()

    # If current track was removed, play the new current
    if q.current_track:
        await _play_track(session_id, q.current_track["uri"])

    return q.to_dict()


@router.post("/shuffle-random")
async def shuffle_random(request: Request):
    """True random shuffle — pick random unplayed songs regardless of metrics."""
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    import random

    q = get_queue(session_id)
    if not q.all_tracks:
        return Response(status_code=400, content="No library loaded")

    current_id = q.current_track["id"] if q.current_track else None
    available = [t for t in q.all_tracks if t["id"] not in q.played and t["id"] != current_id]
    random.shuffle(available)

    slots = q.queue_size - (1 if current_id else 0)
    new_tracks = available[:slots]

    if current_id and q.current_track:
        new_tracks.insert(0, q.current_track)

    q.tracks = new_tracks[: q.queue_size]
    q.current_index = 0 if q.tracks else -1
    q.last_weights = {}
    mark_dirty()

    # Only start playback if the current track changed
    if q.current_track and (not current_id or q.current_track["id"] != current_id):
        await _play_track(session_id, q.current_track["uri"])

    return q.to_dict()


@router.post("/size")
async def set_queue_size(request: Request, body: QueueSizeBody):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    q.queue_size = max(1, min(50, body.size))

    # Resize: trim or refill
    if len(q.tracks) > q.queue_size:
        q.tracks = q.tracks[: q.queue_size]
    else:
        q._refill()

    mark_dirty()
    return q.to_dict()


@router.post("/skip")
async def skip(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    track = q.skip()
    if track:
        mark_dirty()
        await _play_track(session_id, track["uri"])
        return q.to_dict()
    return Response(status_code=404, content="No next track")


@router.post("/previous")
async def previous(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    track = q.previous()
    if track:
        await _play_track(session_id, track["uri"])
        return q.to_dict()
    return Response(status_code=404, content="No previous track")


@router.post("/jump/{index}")
async def jump(request: Request, index: int):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    track = q.jump(index)
    if track:
        mark_dirty()
        await _play_track(session_id, track["uri"])
        return q.to_dict()
    return Response(status_code=404, content="Invalid index")


@router.post("/restart")
async def restart(request: Request):
    """Restart the current track from the beginning."""
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    if q.current_track:
        await spotify_request(session_id, "PUT", "/me/player/seek?position_ms=0")
        return q.to_dict()
    return Response(status_code=404, content="No current track")


@router.post("/shuffle")
async def shuffle(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    q.shuffle()
    mark_dirty()
    return q.to_dict()


@router.delete("/{index}")
async def remove_from_queue(request: Request, index: int):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    removed = q.remove_track(index)
    if removed is None:
        return Response(status_code=404, content="Invalid index")

    mark_dirty()
    # If we removed the current track, play the new current
    if q.current_track:
        await _play_track(session_id, q.current_track["uri"])

    return q.to_dict()


@router.delete("")
async def clear_queue(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    q = get_queue(session_id)
    q.clear()
    mark_dirty()
    await spotify_request(session_id, "PUT", "/me/player/pause")
    return q.to_dict()
