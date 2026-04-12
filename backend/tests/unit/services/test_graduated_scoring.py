from app.services.scoring import (
    TrackData,
    _build_graduated_scorer,
    compute_weighted_score,
    score_track,
)


def _data(
    artist_genres: list[str] | None = None,
    album_genres: list[str] | None = None,
    audio: dict | None = None,
) -> TrackData:
    return TrackData(
        track={"name": "Test", "album": {"name": "Album"}, "artists": []},
        artist_genres=artist_genres or [],
        album_genres=album_genres or [],
        audio_features=audio or {},
    )


HOUSE_CFG = {
    "genres": {"primary": ["house"], "artist_score": 80, "album_score": 65},
    "subgenres": {"keywords": ["funky house"], "bonus": 10},
    "audio_boosts": [{"feature": "energy", "weight": 15}],
    "tempo": [{"min": 118, "max": 132, "bonus": 10}],
}


class TestGraduatedScorer:
    def test_artist_genre_match_should_return_artist_score(self):
        scorer = _build_graduated_scorer(HOUSE_CFG)
        assert scorer(_data(artist_genres=["deep house"], audio={"energy": 0})) == 80

    def test_album_genre_fallback_should_return_album_score(self):
        scorer = _build_graduated_scorer(HOUSE_CFG)
        assert scorer(_data(album_genres=["tech house"], audio={"energy": 0})) == 65

    def test_subgenre_bonus_should_stack(self):
        scorer = _build_graduated_scorer(HOUSE_CFG)
        assert scorer(_data(artist_genres=["funky house"], audio={"energy": 0})) == 90

    def test_audio_boost_should_add_weighted_value(self):
        scorer = _build_graduated_scorer(HOUSE_CFG)
        # 80 (genre) + 12 (int(15*0.8)) = 92
        assert scorer(_data(artist_genres=["house"], audio={"energy": 0.8})) == 92

    def test_inverted_audio_boost(self):
        # Arrange
        cfg = {
            "genres": {"primary": ["chill"], "artist_score": 75, "album_score": 60},
            "audio_boosts": [{"feature": "energy", "weight": 20, "invert": True}],
        }
        scorer = _build_graduated_scorer(cfg)

        # Act / Assert — energy=0.2 inverted → 0.8, 75 + int(20*0.8) = 91
        assert scorer(_data(artist_genres=["chill"], audio={"energy": 0.2})) == 91

    def test_tempo_in_range_should_add_bonus(self):
        scorer = _build_graduated_scorer(HOUSE_CFG)
        assert scorer(_data(artist_genres=["house"], audio={"energy": 0, "tempo": 125})) == 90

    def test_tempo_out_of_range_should_not_add_bonus(self):
        scorer = _build_graduated_scorer(HOUSE_CFG)
        assert scorer(_data(artist_genres=["house"], audio={"energy": 0, "tempo": 100})) == 80

    def test_no_genre_match_should_only_get_audio_score(self):
        scorer = _build_graduated_scorer(HOUSE_CFG)
        assert scorer(_data(artist_genres=["jazz"], audio={"energy": 0.9})) == int(15 * 0.9)


class TestScoreTrackAndWeighted:
    def test_score_track_should_clamp_to_0_100(self):
        # Arrange
        track = {
            "name": "Test",
            "album": {"name": "Album"},
            "artists": [],
            "_artist_genres": ["house"],
            "_album_genres": [],
            "_audio_features": {"energy": 0.9, "danceability": 0.9, "tempo": 125},
        }

        # Act
        scores = score_track(track)

        # Assert
        assert all(0 <= v <= 100 for v in scores.values())

    def test_compute_weighted_score_should_return_weighted_average(self):
        scores = {"hebrew": 100, "hype": 50}
        weights = {"hebrew": 70, "hype": 30}
        assert compute_weighted_score(scores, weights) == 85.0

    def test_compute_weighted_score_on_zero_weights_should_return_zero(self):
        assert compute_weighted_score({"a": 100}, {"a": 0}) == 0.0
