import json
import time
from pathlib import Path
import httpx
from app.config import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_TOKEN_URL, SPOTIFY_API_BASE

_SESSIONS_FILE = Path(__file__).resolve().parent.parent / "_sessions.json"

# Session store: session_id -> { access_token, refresh_token, expires_at }
sessions: dict[str, dict] = {}


def _load_sessions() -> None:
    if _SESSIONS_FILE.exists():
        try:
            sessions.update(json.loads(_SESSIONS_FILE.read_text()))
        except Exception:
            pass


def _save_sessions() -> None:
    try:
        _SESSIONS_FILE.write_text(json.dumps(sessions))
    except Exception:
        pass


# Load on import so sessions survive reloads
_load_sessions()


def add_session(session_id: str, data: dict) -> None:
    sessions[session_id] = data
    _save_sessions()


async def refresh_token_if_needed(session_id: str) -> str | None:
    """Return a valid access token, refreshing if expired."""
    session = sessions.get(session_id)
    if not session:
        return None

    if time.time() >= session["expires_at"]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                SPOTIFY_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": session["refresh_token"],
                    "client_id": SPOTIFY_CLIENT_ID,
                    "client_secret": SPOTIFY_CLIENT_SECRET,
                },
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            session["access_token"] = data["access_token"]
            session["expires_at"] = time.time() + data["expires_in"] - 60
            if "refresh_token" in data:
                session["refresh_token"] = data["refresh_token"]
            _save_sessions()

    return session["access_token"]


async def spotify_request(
    session_id: str,
    method: str,
    path: str,
    **kwargs,
) -> httpx.Response:
    """Make an authenticated request to the Spotify API."""
    token = await refresh_token_if_needed(session_id)
    if not token:
        raise ValueError("No valid token")

    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method,
            f"{SPOTIFY_API_BASE}{path}",
            headers={"Authorization": f"Bearer {token}"},
            **kwargs,
        )
    return resp
