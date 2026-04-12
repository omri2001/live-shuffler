"""E2e tests for the auth endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.spotify import sessions


def _mock_callback_client(user_id: str = "spotify-user-1"):
    """Create a mock httpx.AsyncClient that handles token exchange + /me."""
    token_resp = MagicMock()
    token_resp.status_code = 200
    token_resp.json.return_value = {
        "access_token": "test-access",
        "refresh_token": "test-refresh",
        "expires_in": 3600,
    }

    me_resp = MagicMock()
    me_resp.status_code = 200
    me_resp.json.return_value = {"id": user_id}

    mock_client = AsyncMock()
    mock_client.post.return_value = token_resp
    mock_client.get.return_value = me_resp
    return mock_client


@pytest.mark.e2e
class TestAuthFlow:
    def test_login_should_redirect_to_spotify(self):
        # Arrange
        client = TestClient(app, follow_redirects=False)

        # Act
        resp = client.get("/api/auth/login")

        # Assert
        assert resp.status_code == 307
        assert "accounts.spotify.com/authorize" in resp.headers["location"]

    def test_callback_on_success_should_create_session(self):
        # Arrange
        mock_client = _mock_callback_client()
        client = TestClient(app, follow_redirects=False)

        with patch("httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            mock_cls.return_value.__aexit__.return_value = False

            # Act
            resp = client.get("/api/auth/callback?code=test-code")

        # Assert
        assert resp.status_code == 307
        assert "session=" in resp.headers["location"]

    def test_callback_on_failure_should_redirect_with_error(self):
        # Arrange
        mock_resp = MagicMock()
        mock_resp.status_code = 400

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp

        client = TestClient(app, follow_redirects=False)

        with patch("httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            mock_cls.return_value.__aexit__.return_value = False

            # Act
            resp = client.get("/api/auth/callback?code=bad-code")

        # Assert
        assert resp.status_code == 307
        assert "error=token_exchange_failed" in resp.headers["location"]

    def test_callback_should_reuse_session_for_same_user(self):
        # Arrange — existing session for this Spotify user
        old_session_id = "existing-session"
        sessions[old_session_id] = {
            "access_token": "old-token",
            "refresh_token": "old-refresh",
            "expires_at": 0,
            "user_id": "spotify-user-reuse",
        }

        mock_client = _mock_callback_client(user_id="spotify-user-reuse")
        client = TestClient(app, follow_redirects=False)

        with patch("httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value = mock_client
            mock_cls.return_value.__aexit__.return_value = False

            # Act
            resp = client.get("/api/auth/callback?code=new-code")

        # Assert — same session_id reused, tokens updated
        assert resp.status_code == 307
        location = resp.headers["location"]
        assert f"session={old_session_id}" in location
        assert sessions[old_session_id]["access_token"] == "test-access"

        # Cleanup
        sessions.pop(old_session_id, None)


@pytest.mark.e2e
class TestLogout:
    def test_logout_should_clear_session(self):
        # Arrange
        session_id = "logout-test"
        sessions[session_id] = {"access_token": "x", "refresh_token": "y", "expires_at": 0}
        client = TestClient(app, cookies={"session_id": session_id})

        # Act
        resp = client.post("/api/auth/logout")

        # Assert
        assert resp.status_code == 200
        assert session_id not in sessions
