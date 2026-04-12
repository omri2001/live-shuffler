import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.queue import queues
from app.services.spotify import sessions


@pytest.fixture()
def client():
    """TestClient with an authenticated session pre-loaded."""
    session_id = "test-session"
    sessions[session_id] = {
        "access_token": "fake-token",
        "refresh_token": "fake-refresh",
        "expires_at": 9999999999,
    }
    c = TestClient(app, cookies={"session_id": session_id})
    yield c
    # Cleanup
    sessions.pop(session_id, None)
    queues.pop(session_id, None)


@pytest.fixture()
def unauthenticated_client():
    return TestClient(app)
