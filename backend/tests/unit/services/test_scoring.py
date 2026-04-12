import re

from app.services.scoring import (
    _build_binary_scorer,
    _build_graduated_scorer,
    _genre_contains,
    _text_matches,
    compute_weighted_score,
    score_track,
    TrackData,
)


def _data(
    artist_genres: list[str] | None = None,
    album_genres: list[str] | None = None,
    audio: dict | None = None,
    track: dict | None = None,
) -> TrackData:
    return TrackData(
        track=track or {"name": "Test", "album": {"name": "Album"}, "artists": []},
        artist_genres=artist_genres or [],
        album_genres=album_genres or [],
        audio_features=audio or {},
    )


class TestHelpers:
    def test_genre_contains_should_match_substring(self):
        assert _genre_contains(["deep house", "tech house"], "house") is True

    def test_genre_contains_on_no_match_should_return_false(self):
        assert _genre_contains(["jazz"], "house") is False

    def test_text_matches_on_track_name_should_return_true(self):
        # Arrange
        track = {"name": "שיר בעברית", "album": {"name": "Album"}, "artists": []}
        pattern = re.compile(r"[\u0590-\u05FF]")

        # Act / Assert
        assert _text_matches(track, pattern) is True

    def test_text_matches_on_artist_name_should_return_true(self):
        # Arrange
        track = {"name": "Song", "album": {"name": "Album"}, "artists": [{"name": "אמן"}]}

        # Act / Assert
        assert _text_matches(track, re.compile(r"[\u0590-\u05FF]")) is True


class TestBinaryScorer:
    def test_binary_scorer_on_text_match_should_return_100(self):
        # Arrange
        scorer = _build_binary_scorer({"text_regex": r"[\u0590-\u05FF]"})
        data = _data(track={"name": "שיר", "album": {"name": "Album"}, "artists": []})

        # Act / Assert
        assert scorer(data) == 100

    def test_binary_scorer_on_genre_keyword_should_return_100(self):
        # Arrange
        scorer = _build_binary_scorer({"genre_keywords": ["hebrew", "israeli"]})

        # Act / Assert
        assert scorer(_data(artist_genres=["hebrew pop"])) == 100
        assert scorer(_data(album_genres=["israeli rock"])) == 100

    def test_binary_scorer_on_no_match_should_return_0(self):
        scorer = _build_binary_scorer({"genre_keywords": ["hebrew"]})
        assert scorer(_data(artist_genres=["pop", "rock"])) == 0
