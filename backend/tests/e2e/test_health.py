"""E2e test for health endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.mark.e2e
class TestHealth:
    def test_health_should_return_ok(self):
        # Act
        resp = TestClient(app).get("/api/health")

        # Assert
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
