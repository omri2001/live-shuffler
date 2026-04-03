"""Generic, pluggable song scoring engine.

To add a new criterion, just define a function and decorate it:

    @scorer("rock")
    def score_rock(data: TrackData) -> int:
        if _genre_contains(data["artist_genres"], "rock"):
            return 80
        if _genre_contains(data["album_genres"], "rock"):
            return 60
        return 0

That's it — no other code changes needed. It auto-appears in all score outputs.

Note: Spotify deprecated the audio features API in Nov 2024 (returns 403).
All scoring is based on artist/album genre tags and track metadata only.
"""

from __future__ import annotations

import re
from typing import Callable, TypedDict

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class TrackData(TypedDict):
    track: dict              # Spotify track object
    artist_genres: list[str] # Merged genres from track's own artists
    album_genres: list[str]  # Merged genres from ALL artists on the album
    audio_features: dict     # From ReccoBeats (energy, danceability, tempo, etc.)


Scorer = Callable[[TrackData], int]

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

SCORERS: dict[str, Scorer] = {}


def scorer(name: str):
    """Decorator to register a scorer function under *name*."""
    def decorator(fn: Scorer) -> Scorer:
        SCORERS[name] = fn
        return fn
    return decorator


def score_track(track: dict) -> dict[str, int]:
    """Run all registered scorers on an enriched track. Returns {name: 0-100}."""
    data = TrackData(
        track=track,
        artist_genres=[g.lower() for g in track.get("_artist_genres", [])],
        album_genres=[g.lower() for g in track.get("_album_genres", [])],
        audio_features=track.get("_audio_features", {}),
    )
    return {name: max(0, min(100, fn(data))) for name, fn in SCORERS.items()}


def get_scorer_names() -> list[str]:
    """Return all registered criterion names."""
    return list(SCORERS.keys())


def compute_weighted_score(track_scores: dict[str, int], weights: dict[str, int]) -> float:
    """Compute a weighted score for a track given metric weights.

    Returns 0-100 float. If all weights are 0, returns 0.
    """
    total_weight = sum(w for w in weights.values() if w > 0)
    if total_weight == 0:
        return 0.0
    weighted_sum = sum(track_scores.get(name, 0) * w for name, w in weights.items() if w > 0)
    return weighted_sum / total_weight


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

_HEBREW_RE = re.compile(r"[\u0590-\u05FF]")
_NON_ENGLISH_RE = re.compile(r"[^\x00-\x7F]")


def _genre_contains(genres: list[str], *keywords: str) -> bool:
    return any(kw in g for g in genres for kw in keywords)


# ---------------------------------------------------------------------------
# Built-in scorers
#
# Each scorer checks (in priority order):
#   1) track's own artist genres (strongest signal, 85)
#   2) album-level genres from all artists (catches featured artists, 70)
# ---------------------------------------------------------------------------

@scorer("hebrew")
def score_hebrew(data: TrackData) -> int:
    """Binary: 100 if Hebrew, 0 otherwise."""
    track = data["track"]
    if _HEBREW_RE.search(track.get("name", "")):
        return 100
    if _HEBREW_RE.search(track.get("album", {}).get("name", "")):
        return 100
    if _genre_contains(data["artist_genres"], "hebrew", "israeli"):
        return 100
    if _genre_contains(data["album_genres"], "hebrew", "israeli"):
        return 100
    for artist in track.get("artists", []):
        if _HEBREW_RE.search(artist.get("name", "")):
            return 100
    return 0


@scorer("non_english")
def score_non_english(data: TrackData) -> int:
    """Binary: 100 if non-English, 0 otherwise."""
    track = data["track"]
    all_genres = data["artist_genres"] + data["album_genres"]
    if _NON_ENGLISH_RE.search(track.get("name", "")):
        return 100
    if _NON_ENGLISH_RE.search(track.get("album", {}).get("name", "")):
        return 100
    for artist in track.get("artists", []):
        if _NON_ENGLISH_RE.search(artist.get("name", "")):
            return 100
    non_english_markers = (
        "hebrew", "israeli", "latin", "reggaeton", "k-pop", "j-pop",
        "french", "german", "spanish", "arabic", "turkish", "korean",
        "japanese", "chinese", "brazilian", "afrobeat", "bollywood",
        "hindi", "punjabi", "portuguese", "italian", "swedish",
        "mpb", "samba", "bossa nova", "forr", "sertanejo", "axe",
        "cumbia", "vallenato", "bachata", "flamenco", "fado",
        "mandopop", "cantopop", "schlager", "chanson", "enka",
        "mizrahi",
    )
    if _genre_contains(all_genres, *non_english_markers):
        return 100
    return 0


@scorer("hiphop")
def score_hiphop(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "hip hop", "rap", "trap"):
        score = 75
    elif _genre_contains(album_genres, "hip hop", "rap", "trap"):
        score = 60
    if _genre_contains(genres + album_genres, "gangsta rap", "drill", "grime", "crunk"):
        score += 10
    # Speechiness boost (rap = high speechiness)
    score += int(15 * af.get("speechiness", 0))
    return score


@scorer("pop")
def score_pop(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "pop"):
        score = 70
    elif _genre_contains(album_genres, "pop"):
        score = 55
    score += int(15 * af.get("danceability", 0))
    score += int(15 * af.get("valence", 0))
    return score


@scorer("metal")
def score_metal(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "metal", "metalcore", "deathcore"):
        score = 75
    elif _genre_contains(album_genres, "metal", "metalcore", "deathcore"):
        score = 60
    all_genres = genres + album_genres
    if _genre_contains(all_genres, "death metal", "black metal", "thrash metal", "doom metal", "heavy metal", "groove metal", "nu metal", "progressive metal"):
        score += 15
    # Energy boost + low valence (dark, aggressive)
    score += int(10 * af.get("energy", 0))
    score += int(5 * (1 - af.get("valence", 0.5)))
    return score


@scorer("jungle")
def score_jungle(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "jungle"):
        score = 75
    elif _genre_contains(album_genres, "jungle"):
        score = 60
    if _genre_contains(genres + album_genres, "breakcore", "breakbeat", "ragga jungle"):
        score += 10
    # Fast tempo boost
    tempo = af.get("tempo", 0)
    if tempo >= 160:
        score += 15
    return score


@scorer("dnb")
def score_dnb(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "drum and bass", "dnb", "d&b", "liquid funk"):
        score = 75
    elif _genre_contains(album_genres, "drum and bass", "dnb", "d&b", "liquid funk"):
        score = 60
    if _genre_contains(genres + album_genres, "neurofunk", "jump up", "liquid dnb"):
        score += 10
    # DnB is 170-180 BPM
    tempo = af.get("tempo", 0)
    if 165 <= tempo <= 185:
        score += 15
    return score


@scorer("dubstep")
def score_dubstep(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "dubstep", "brostep", "riddim"):
        score = 75
    elif _genre_contains(album_genres, "dubstep", "brostep", "riddim"):
        score = 60
    if _genre_contains(genres + album_genres, "bass music", "filthstep", "tearout"):
        score += 10
    # High energy + ~140 BPM
    score += int(10 * af.get("energy", 0))
    tempo = af.get("tempo", 0)
    if 135 <= tempo <= 150:
        score += 10
    return score


@scorer("jazz")
def score_jazz(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "jazz"):
        score = 75
    elif _genre_contains(album_genres, "jazz"):
        score = 60
    if _genre_contains(genres + album_genres, "bebop", "swing", "fusion", "smooth jazz", "nu jazz", "acid jazz"):
        score += 10
    # Acoustic + instrumental boost
    score += int(10 * af.get("acousticness", 0))
    score += int(10 * af.get("instrumentalness", 0))
    return score


@scorer("chill")
def score_chill(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "chill", "chillout", "lo-fi", "ambient", "downtempo", "chillwave", "lounge"):
        score = 70
    elif _genre_contains(album_genres, "chill", "chillout", "lo-fi", "ambient", "downtempo", "chillwave", "lounge"):
        score = 55
    # Low energy + high acousticness = chill
    score += int(15 * (1 - af.get("energy", 0.5)))
    score += int(10 * af.get("acousticness", 0))
    # Slow tempo boost
    tempo = af.get("tempo", 120)
    if tempo < 100:
        score += 10
    elif tempo < 120:
        score += 5
    return score


@scorer("dance")
def score_dance(data: TrackData) -> int:
    genres = data["artist_genres"]
    album_genres = data["album_genres"]
    af = data["audio_features"]
    score = 0
    if _genre_contains(genres, "dance", "edm", "house", "techno", "trance", "electro"):
        score = 70
    elif _genre_contains(album_genres, "dance", "edm", "house", "techno", "trance", "electro"):
        score = 55
    if _genre_contains(genres + album_genres, "deep house", "tech house", "progressive house", "euro dance"):
        score += 10
    # Danceability is the primary audio signal
    score += int(20 * af.get("danceability", 0))
    score += int(5 * af.get("energy", 0))
    return score
