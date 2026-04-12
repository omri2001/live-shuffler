import secrets
import time
import urllib.parse

import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse

from app.config import (
    FRONTEND_URL,
    SCOPES,
    SPOTIFY_AUTH_URL,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REDIRECT_URI,
    SPOTIFY_TOKEN_URL,
)
from app.services.spotify import add_session, sessions

router = APIRouter()


@router.get("/login")
async def login():
    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": SPOTIFY_CLIENT_ID,
        "scope": SCOPES,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "show_dialog": "true",
    })
    return RedirectResponse(f"{SPOTIFY_AUTH_URL}?{params}")


@router.get("/callback")
async def callback(code: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            SPOTIFY_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": SPOTIFY_REDIRECT_URI,
                "client_id": SPOTIFY_CLIENT_ID,
                "client_secret": SPOTIFY_CLIENT_SECRET,
            },
        )

    if resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=token_exchange_failed")

    data = resp.json()
    session_id = secrets.token_urlsafe(32)

    add_session(session_id, {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "expires_at": time.time() + data["expires_in"] - 60,
    })

    # Redirect to frontend with session token — frontend stores it as cookie
    return RedirectResponse(f"{FRONTEND_URL}?session={session_id}")


@router.get("/me")
async def me(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id or session_id not in sessions:
        return Response(status_code=401)

    from app.services.spotify import spotify_request
    resp = await spotify_request(session_id, "GET", "/me")
    return resp.json()


@router.post("/logout")
async def logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id and session_id in sessions:
        del sessions[session_id]
    return {"ok": True}
