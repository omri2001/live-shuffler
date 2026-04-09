from fastapi import APIRouter, Request, Response

from app.services.spotify import spotify_request, sessions

router = APIRouter()


def get_session_id(request: Request) -> str | None:
    session_id = request.cookies.get("session_id")
    if session_id and session_id in sessions:
        return session_id
    return None


@router.get("/tracks")
async def get_tracks(request: Request, offset: int = 0, limit: int = 50):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    resp = await spotify_request(session_id, "GET", f"/me/tracks?offset={offset}&limit={limit}")
    return resp.json()


@router.get("/player/current")
async def get_current_track(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    resp = await spotify_request(session_id, "GET", "/me/player/currently-playing")
    if resp.status_code == 204:
        return Response(status_code=204)
    return resp.json()


@router.put("/player/play")
async def play(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    body = None
    try:
        body = await request.json()
    except Exception:
        pass
    resp = await spotify_request(session_id, "PUT", "/me/player/play", json=body)
    return Response(status_code=resp.status_code)


@router.put("/player/pause")
async def pause(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    resp = await spotify_request(session_id, "PUT", "/me/player/pause")
    return Response(status_code=resp.status_code)


@router.put("/player/seek")
async def seek(request: Request, position_ms: int = 0):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    resp = await spotify_request(session_id, "PUT", f"/me/player/seek?position_ms={position_ms}")
    return Response(status_code=resp.status_code)


@router.post("/player/next")
async def next_track(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    resp = await spotify_request(session_id, "POST", "/me/player/next")
    return Response(status_code=resp.status_code)


@router.get("/playlists")
async def get_playlists(request: Request, offset: int = 0, limit: int = 50):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    resp = await spotify_request(session_id, "GET", f"/me/playlists?offset={offset}&limit={limit}")
    return resp.json()


@router.get("/albums")
async def get_albums(request: Request, offset: int = 0, limit: int = 50):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    resp = await spotify_request(session_id, "GET", f"/me/albums?offset={offset}&limit={limit}")
    return resp.json()


@router.get("/devices")
async def get_devices(request: Request):
    session_id = get_session_id(request)
    if not session_id:
        return Response(status_code=401)
    resp = await spotify_request(session_id, "GET", "/me/player/devices")
    return resp.json()


@router.get("/genres")
async def get_genres():
    return [
        "Pop", "Rock", "Hip Hop", "Jazz", "Electronic",
        "R&B", "Classical", "Reggae", "Metal", "Country",
        "Latin", "Indie",
    ]
