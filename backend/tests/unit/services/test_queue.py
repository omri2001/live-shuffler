from app.services.queue import QueueState


def _track(id: str, scores: dict | None = None) -> dict:
    """Helper to create a minimal track dict."""
    t = {"id": id, "uri": f"spotify:track:{id}", "name": f"Track {id}"}
    if scores is not None:
        t["_scores"] = scores
    return t


class TestQueueAddAndRemove:
    def test_add_tracks_should_deduplicate_by_id(self):
        # Arrange
        q = QueueState()
        q.add_tracks([_track("a")], "liked")

        # Act
        q.add_tracks([_track("a"), _track("b")], "playlist:1")

        # Assert
        assert len(q.all_tracks) == 2
        assert q.track_sources["a"] == "liked"  # keeps original source

    def test_remove_source_should_remove_tracks_from_library_and_queue(self):
        # Arrange
        q = QueueState(queue_size=5)
        q.add_tracks([_track("a"), _track("b")], "liked")
        q.add_tracks([_track("c")], "playlist:1")
        q.sources.update(["liked", "playlist:1"])
        q.tracks = [_track("a"), _track("b"), _track("c")]
        q.current_index = 0

        # Act
        q.remove_source("liked")

        # Assert
        assert len(q.all_tracks) == 1
        assert all(t["id"] not in ("a", "b") for t in q.tracks)

    def test_remove_track_on_before_current_should_decrement_index(self):
        # Arrange
        q = QueueState(tracks=[_track("a"), _track("b"), _track("c")], current_index=2)

        # Act
        q.remove_track(0)

        # Assert
        assert q.current_index == 1

    def test_remove_track_on_current_at_end_should_clamp_index(self):
        # Arrange
        q = QueueState(tracks=[_track("a"), _track("b")], current_index=1)

        # Act
        q.remove_track(1)

        # Assert
        assert q.current_index == 0


class TestQueueNavigation:
    def test_skip_should_remove_first_and_mark_played(self):
        # Arrange
        q = QueueState(queue_size=3)
        q.all_tracks = [_track("a"), _track("b"), _track("c"), _track("d")]
        q.tracks = [_track("a"), _track("b"), _track("c")]
        q.current_index = 0

        # Act
        result = q.skip()

        # Assert
        assert result["id"] == "b"
        assert "a" in q.played

    def test_skip_on_empty_queue_should_return_none(self):
        # Arrange
        q = QueueState()

        # Act / Assert
        assert q.skip() is None

    def test_jump_should_mark_skipped_tracks_as_played(self):
        # Arrange
        q = QueueState(queue_size=5)
        q.all_tracks = [_track(c) for c in "abcde"]
        q.tracks = [_track(c) for c in "abcde"]
        q.current_index = 0

        # Act
        result = q.jump(2)

        # Assert
        assert result["id"] == "c"
        assert "a" in q.played and "b" in q.played
        assert "c" not in q.played

    def test_sync_should_move_track_to_front_from_queue(self):
        # Arrange
        q = QueueState(tracks=[_track("a"), _track("b"), _track("c")], current_index=0)

        # Act
        q.sync_current_track("c")

        # Assert
        assert q.tracks[0]["id"] == "c"
        assert q.current_index == 0

    def test_sync_should_insert_from_library_if_not_in_queue(self):
        # Arrange
        q = QueueState(queue_size=3)
        q.all_tracks = [_track("a"), _track("b"), _track("c")]
        q.tracks = [_track("a"), _track("b")]
        q.current_index = 0

        # Act
        q.sync_current_track("c")

        # Assert
        assert q.tracks[0]["id"] == "c"

    def test_shuffle_should_keep_current_track_in_place(self):
        # Arrange
        q = QueueState(tracks=[_track(c) for c in "abcde"], current_index=0)

        # Act
        q.shuffle()

        # Assert
        assert q.tracks[0]["id"] == "a"
