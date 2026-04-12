from app.services.queue import QueueState


def _track(id: str, scores: dict | None = None) -> dict:
    t = {"id": id, "uri": f"spotify:track:{id}", "name": f"Track {id}"}
    if scores is not None:
        t["_scores"] = scores
    return t


class TestRerank:
    def test_rerank_should_pick_top_scored_tracks(self):
        # Arrange
        q = QueueState(queue_size=3)
        q.all_tracks = [
            _track("a", {"hype": 100}),
            _track("b", {"hype": 80}),
            _track("c", {"hype": 50}),
            _track("d", {"hype": 0}),
        ]

        # Act
        q.rerank({"hype": 100})

        # Assert
        track_ids = {t["id"] for t in q.tracks}
        assert "a" in track_ids and "b" in track_ids and "c" in track_ids
        assert "d" not in track_ids

    def test_rerank_should_preserve_current_track(self):
        # Arrange
        q = QueueState(queue_size=3)
        q.all_tracks = [
            _track("current", {"hype": 0}),
            _track("a", {"hype": 100}),
            _track("b", {"hype": 90}),
            _track("c", {"hype": 80}),
        ]
        q.tracks = [_track("current")]
        q.current_index = 0

        # Act
        q.rerank({"hype": 100})

        # Assert
        assert q.tracks[0]["id"] == "current"

    def test_rerank_with_multiple_metrics_should_allocate_proportionally(self):
        # Arrange
        q = QueueState(queue_size=10)
        hebrew = [_track(f"h{i}", {"hebrew": 100, "hype": 0}) for i in range(20)]
        hype = [_track(f"y{i}", {"hebrew": 0, "hype": 100}) for i in range(20)]
        q.all_tracks = hebrew + hype

        # Act
        q.rerank({"hebrew": 50, "hype": 50})

        # Assert
        assert len(q.tracks) == 10
        hebrew_count = sum(1 for t in q.tracks if t["_scores"]["hebrew"] == 100)
        hype_count = sum(1 for t in q.tracks if t["_scores"]["hype"] == 100)
        assert hebrew_count == 5
        assert hype_count == 5

    def test_rerank_on_zero_weights_with_empty_queue_should_fill(self):
        # Arrange
        q = QueueState(queue_size=3)
        q.all_tracks = [_track("a"), _track("b"), _track("c")]

        # Act
        q.rerank({"metric": 0})

        # Assert
        assert len(q.tracks) == 3


class TestRefill:
    def test_refill_after_skip_should_maintain_queue_size(self):
        # Arrange
        q = QueueState(queue_size=3)
        q.all_tracks = [_track(c) for c in "abcde"]
        q.tracks = [_track(c) for c in "abc"]
        q.current_index = 0

        # Act
        q.skip()

        # Assert
        assert len(q.tracks) == 3  # refilled to queue_size

    def test_refill_with_weights_should_respect_metric_proportions(self):
        # Arrange
        q = QueueState(queue_size=5)
        scored = [_track(f"s{i}", {"m": 100}) for i in range(10)]
        unscored = [_track(f"u{i}", {"m": 0}) for i in range(10)]
        q.all_tracks = scored + unscored
        q.tracks = [_track("s0", {"m": 100})]
        q.current_index = 0
        q.last_weights = {"m": 100}

        # Act
        q.skip()  # triggers _refill with last_weights

        # Assert
        assert len(q.tracks) == 5
        # All refilled tracks should be scored since weight is 100%
        scored_count = sum(1 for t in q.tracks if t.get("_scores", {}).get("m", 0) > 0)
        assert scored_count >= 4  # at least most should be scored
