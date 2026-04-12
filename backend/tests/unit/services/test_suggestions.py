from app.services.suggestions import (
    SuggestionPool,
    disable_pool,
    enable_pool,
    get_pool_by_code,
)


def _track(id: str) -> dict:
    return {"id": id, "name": f"Track {id}", "uri": f"spotify:track:{id}"}


class TestSuggestionPool:
    def test_submit_should_increment_on_duplicate(self):
        # Arrange
        pool = SuggestionPool()
        pool.submit("t1", _track("t1"))

        # Act
        s = pool.submit("t1", _track("t1"))

        # Assert
        assert s.count == 2

    def test_unvote_on_count_one_should_remove(self):
        # Arrange
        pool = SuggestionPool()
        pool.submit("t1", _track("t1"))

        # Act / Assert
        assert pool.unvote("t1") == 0
        assert "t1" not in pool.suggestions

    def test_unvote_on_nonexistent_should_return_negative_one(self):
        assert SuggestionPool().unvote("missing") == -1

    def test_accept_should_pop_and_return_track(self):
        # Arrange
        pool = SuggestionPool()
        pool.submit("t1", _track("t1"))

        # Act
        track = pool.accept("t1")

        # Assert
        assert track["id"] == "t1"
        assert "t1" not in pool.suggestions

    def test_list_sorted_should_order_by_count_desc(self):
        # Arrange
        pool = SuggestionPool()
        pool.submit("low", _track("low"))
        pool.submit("high", _track("high"))
        pool.submit("high", _track("high"))

        # Act
        items = pool.list_sorted()

        # Assert
        assert items[0]["track_id"] == "high"


class TestPoolManagement:
    def test_enable_disable_lifecycle(self):
        # Arrange / Act
        pool = enable_pool("session-lifecycle-test")
        code = pool.code

        # Assert — enabled
        assert pool.enabled is True
        assert get_pool_by_code(code) is pool

        # Act — disable
        pool.submit("t1", _track("t1"))
        disable_pool("session-lifecycle-test")

        # Assert — disabled
        assert pool.enabled is False
        assert pool.code == ""
        assert len(pool.suggestions) == 0
        assert get_pool_by_code(code) is None

    def test_get_pool_by_code_on_invalid_should_return_none(self):
        assert get_pool_by_code("nonexistent") is None
