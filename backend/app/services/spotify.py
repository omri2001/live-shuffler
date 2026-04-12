import asyncio
import contextlib
import json
import time
from pathlib import Path

import httpx

from app.config import SPOTIFY_API_BASE, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_TOKEN_URL

_SESSIONS_FILE = Path(__file__).resolve().parent.parent / "_sessions.json"

# Session store: session_id -> { access_token, refresh_token, expires_at }
sessions: dict[str, dict] = {}

# Per-session locks to prevent concurrent token refreshes
_refresh_locks: dict[str, asyncio.Lock] = {}

# Debounce timer for session file saves
_save_task: asyncio.TimerHandle | None = None


def _load_sessions() -> None:
    if _SESSIONS_FILE.exists():
        with contextlib.suppress(Exception):
            sessions.update(json.loads(_SESSIONS_FILE.read_text()))


def _save_sessions_now() -> None:
    with contextlib.suppress(Exception):
        _SESSIONS_FILE.write_text(json.dumps(sessions))


def _schedule_save() -> None:
    """Debounce session file writes — coalesce saves within 1 second."""
    global _save_task
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No event loop (e.g. during import) — save immediately
        _save_sessions_now()
        return
    if _save_task is not None:
        _save_task.cancel()
    _save_task = loop.call_later(1.0, _save_sessions_now)


# Load on import so sessions survive reloads
_load_sessions()


def add_session(session_id: str, data: dict) -> None:
    sessions[session_id] = data
    _schedule_save()


async def refresh_token_if_needed(session_id: str) -> str | None:
    """Return a valid access token, refreshing if expired."""
    session = sessions.get(session_id)
    if not session:
        return None

    # Fast path: token still valid, no lock needed
    if time.time() < session["expires_at"]:
        return session["access_token"]

    # Slow path: acquire per-session lock so only one refresh happens
    if session_id not in _refresh_locks:
        _refresh_locks[session_id] = asyncio.Lock()

    async with _refresh_locks[session_id]:
        # Re-check after acquiring lock — another coroutine may have refreshed
        if time.time() < session["expires_at"]:
            return session["access_token"]

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
            _schedule_save()

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
        for _attempt in range(3):
            resp = await client.request(
                method,
                f"{SPOTIFY_API_BASE}{path}",
                headers={"Authorization": f"Bearer {token}"},
                **kwargs,
            )
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 2))
                await asyncio.sleep(retry_after)
                continue
            return resp
    return resp
