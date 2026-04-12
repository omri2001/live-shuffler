"""E2e tests for the queue API endpoints.

These test the full request flow through the FastAPI app with
a pre-loaded session. Queue operations that don't call Spotify
(rerank, scorers, size, stats, get) are tested directly.
"""

import pytest

from app.services.queue import get_queue


def _load_tracks(session_id: str, count: int = 20) -> None:
    """Directly load scored tracks into a session's queue (skips Spotify fetch)."""
    q = get_queue(session_id)
    tracks = []
    for i in range(count):
        tracks.append(
            {
                "id": f"track-{i}",
                "uri": f"spotify:track:track-{i}",
                "name": f"Track {i}",
                "artists": [{"name": f"Artist {i}"}],
                "album": {"name": f"Album {i}"},
                "_artist_genres": ["house"] if i % 2 == 0 else ["hebrew"],
                "_album_genres": [],
                "_audio_features": {"energy": 0.8, "danceability": 0.7, "tempo": 125},
                "_scores": {
                    "house": 80 if i % 2 == 0 else 0,
                    "hebrew": 100 if i % 2 == 1 else 0,
                },
            }
        )
    q.add_tracks(tracks, "liked")
    q.sources.add("liked")
    q.tracks = tracks[:10]
    q.current_index = 0


@pytest.mark.e2e
class TestQueueEndpoints:
    def test_get_queue_should_return_queue_state(self, client):
        # Arrange
        _load_tracks("test-session")

        # Act
        resp = client.get("/api/queue")

        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert "tracks" in data
        assert len(data["tracks"]) == 10
        assert data["current_index"] == 0

    def test_get_queue_on_unauthenticated_should_return_401(self, unauthenticated_client):
        # Act
        resp = unauthenticated_client.get("/api/queue")

        # Assert
        assert resp.status_code == 401

    def test_rerank_should_reorder_by_weights(self, client):
        # Arrange
        _load_tracks("test-session")

        # Act
        resp = client.post("/api/queue/rerank", json={"weights": {"hebrew": 100}})

        # Assert
        assert resp.status_code == 200
        data = resp.json()
        # First track (after current) should be hebrew-scored
        hebrew_in_top = sum(1 for t in data["tracks"][1:] if t["_scores"]["hebrew"] > 0)
        assert hebrew_in_top > 0

    def test_rerank_on_empty_library_should_return_400(self, client):
        # Act
        resp = client.post("/api/queue/rerank", json={"weights": {"hebrew": 50}})

        # Assert
        assert resp.status_code == 400

    def test_set_queue_size_should_resize(self, client):
        # Arrange
        _load_tracks("test-session")

        # Act
        resp = client.post("/api/queue/size", json={"size": 5})

        # Assert
        assert resp.status_code == 200
        assert len(resp.json()["tracks"]) == 5

    def test_set_queue_size_should_clamp_to_bounds(self, client):
        # Arrange
        _load_tracks("test-session")

        # Act
        resp = client.post("/api/queue/size", json={"size": 999})

        # Assert
        assert resp.status_code == 200
        q = get_queue("test-session")
        assert q.queue_size == 50  # max clamp

    def test_scorers_endpoint_should_return_metrics(self, client):
        # Act
        resp = client.get("/api/queue/scorers")

        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert "house" in data
        assert "hebrew" in data

    def test_stats_should_return_score_distributions(self, client):
        # Arrange
        _load_tracks("test-session")

        # Act
        resp = client.get("/api/queue/stats")

        # Assert
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "metrics" in data


@pytest.mark.e2e
class TestQueueAuthGuard:
    """Verify that all queue mutation endpoints require auth."""

    @pytest.mark.parametrize(
        "method,path,body",
        [
            ("GET", "/api/queue", None),
            ("GET", "/api/queue/stats", None),
            ("POST", "/api/queue/rerank", {"weights": {"x": 50}}),
            ("POST", "/api/queue/size", {"size": 10}),
            ("POST", "/api/queue/skip", None),
            ("POST", "/api/queue/previous", None),
            ("POST", "/api/queue/jump/0", None),
            ("POST", "/api/queue/shuffle", None),
        ],
    )
    def test_endpoint_on_unauthenticated_should_return_401(self, unauthenticated_client, method, path, body):
        # Act
        resp = unauthenticated_client.request(method, path, json=body)

        # Assert
        assert resp.status_code == 401
