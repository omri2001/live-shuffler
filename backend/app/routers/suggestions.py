from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.services.queue import get_queue
from app.services.spotify import sessions, spotify_request
from app.services.suggestions import disable_pool, enable_pool, get_pool, get_pool_by_code

router = APIRouter()


def _get_session_id(request: Request) -> str | None:
    session_id = request.cookies.get("session_id")
    if session_id and session_id in sessions:
        return session_id
    return None


# ── DJ endpoints (require auth) ──


@router.post("/enable")
async def enable(request: Request):
    session_id = _get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    pool = enable_pool(session_id)
    return {"enabled": True, "code": pool.code, "count": len(pool.suggestions)}


@router.post("/disable")
async def disable(request: Request):
    session_id = _get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    disable_pool(session_id)
    return {"enabled": False, "code": "", "count": 0}


@router.get("/status")
async def status(request: Request):
    session_id = _get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    pool = get_pool(session_id)
    return {"enabled": pool.enabled, "code": pool.code, "count": len(pool.suggestions)}


@router.get("/list")
async def list_suggestions(request: Request):
    session_id = _get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    pool = get_pool(session_id)
    return {"suggestions": pool.list_sorted()}


@router.post("/accept/{track_id}")
async def accept(request: Request, track_id: str):
    session_id = _get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    pool = get_pool(session_id)
    suggestion_track = pool.accept(track_id)
    if not suggestion_track:
        return Response(status_code=404, content="Suggestion not found")

    # Fetch full Spotify track object (the suggestion only has minimal data)
    resp = await spotify_request(session_id, "GET", f"/tracks/{track_id}")
    if resp.status_code != 200:
        return Response(status_code=404, content="Track not found on Spotify")
    track = resp.json()

    # Enrich and score
    from app.services.metadata import attach_enrichment, enrich_artist_genres, enrich_audio_features
    from app.services.score_cache import get_cached_scores, set_cached_scores_bulk
    from app.services.scoring import score_track

    cached = get_cached_scores(track_id)
    if cached:
        track["_scores"] = cached
    else:
        genre_map = await enrich_artist_genres(session_id, [track])
        audio_map = await enrich_audio_features([track])
        [track] = attach_enrichment([track], genre_map, {}, audio_map)
        track["_scores"] = score_track(track)
        set_cached_scores_bulk({track_id: track["_scores"]})

    # Insert as "next up" (after the currently playing track)
    q = get_queue(session_id)
    insert_at = min(1, len(q.tracks))  # after current, or at 0 if queue is empty
    q.tracks.insert(insert_at, track)
    if len(q.tracks) > q.queue_size:
        q.tracks = q.tracks[:q.queue_size]

    return {"queue": q.to_dict(), "remaining": len(pool.suggestions)}


@router.post("/dismiss/{track_id}")
async def dismiss(request: Request, track_id: str):
    session_id = _get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    pool = get_pool(session_id)
    pool.dismiss(track_id)
    return {"remaining": len(pool.suggestions)}


# ── Guest endpoints (require code, no auth) ──


@router.get("/search")
async def search(code: str, q: str):
    pool = get_pool_by_code(code)
    if not pool:
        return Response(status_code=403, content="Invalid or expired code")
    if not q or len(q) < 2:
        return {"tracks": []}

    resp = await spotify_request(pool.dj_session_id, "GET", f"/search?q={q}&type=track&limit=10")
    if resp.status_code != 200:
        return {"tracks": []}

    items = resp.json().get("tracks", {}).get("items", [])
    # Return minimal track data
    tracks = []
    for t in items:
        if not t or not t.get("id"):
            continue
        images = t.get("album", {}).get("images", [])
        tracks.append({
            "id": t["id"],
            "name": t.get("name", ""),
            "artists": [a["name"] for a in t.get("artists", [])],
            "album": t.get("album", {}).get("name", ""),
            "image": images[0]["url"] if images else "",
            "uri": t.get("uri", ""),
        })
    return {"tracks": tracks}


class SubmitBody(BaseModel):
    code: str
    track_id: str
    track: dict


@router.post("/submit")
async def submit(body: SubmitBody):
    pool = get_pool_by_code(body.code)
    if not pool:
        return Response(status_code=403, content="Invalid or expired code")

    s = pool.submit(body.track_id, body.track)
    return {"count": s.count}


class UnvoteBody(BaseModel):
    code: str
    track_id: str


@router.post("/unvote")
async def unvote(body: UnvoteBody):
    pool = get_pool_by_code(body.code)
    if not pool:
        return Response(status_code=403, content="Invalid or expired code")
    count = pool.unvote(body.track_id)
    return {"count": count}


@router.get("/pool")
async def get_suggestion_pool(code: str):
    pool = get_pool_by_code(code)
    if not pool:
        return Response(status_code=403, content="Invalid or expired code")
    return {"suggestions": pool.list_sorted()}
