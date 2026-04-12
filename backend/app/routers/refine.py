import json
import statistics

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.metadata import attach_enrichment, enrich_artist_genres, enrich_audio_features
from app.services.queue import get_queue
from app.services.scoring import SCORERS, get_metric_full_configs, score_track_with_breakdown
from app.services.spotify import get_user_id, sessions, spotify_request
from app.services.tracks import fetch_tracks_for_source

router = APIRouter()

AUDIO_FEATURE_NAMES = [
    "energy",
    "danceability",
    "valence",
    "acousticness",
    "instrumentalness",
    "liveness",
    "speechiness",
    "loudness",
]
SCORE_BUCKETS = [
    ("0", 0, 0),
    ("1-19", 1, 19),
    ("20-39", 20, 39),
    ("40-59", 40, 59),
    ("60-79", 60, 79),
    ("80-100", 80, 100),
]


def _get_session_id(request: Request) -> str | None:
    session_id = request.cookies.get("session_id")
    if session_id and session_id in sessions:
        return session_id
    return None


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.get("/metrics")
async def get_metrics():
    """Return full YAML configs for all metrics."""
    return get_metric_full_configs()


@router.get("/inspect/{track_id}")
async def inspect_track(request: Request, track_id: str):
    """Return per-metric breakdowns for a single track."""
    session_id = _get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    # Try to find the track in the queue
    q = get_queue(get_user_id(session_id))
    track = None
    for t in q.all_tracks:
        if t["id"] == track_id:
            track = t
            break
    if not track:
        for t in q.tracks:
            if t["id"] == track_id:
                track = t
                break

    # If not in queue at all, fetch from Spotify
    if not track:
        resp = await spotify_request(session_id, "GET", f"/tracks/{track_id}")
        if resp.status_code != 200:
            return Response(status_code=404, content="Track not found")
        track = resp.json()

    # Enrich if missing enrichment data (cached tracks only have _scores)
    if not track.get("_artist_genres") or not track.get("_audio_features"):
        genre_map = await enrich_artist_genres(session_id, [track])
        audio_map = await enrich_audio_features([track])
        attach_enrichment([track], genre_map, {}, audio_map)

    # Score against every metric with breakdowns
    breakdowns: dict[str, dict] = {}
    for metric_name in SCORERS:
        breakdowns[metric_name] = score_track_with_breakdown(track, metric_name)

    return {
        "track_id": track_id,
        "name": track.get("name", ""),
        "artists": [a["name"] for a in track.get("artists", [])],
        "album": track.get("album", {}).get("name", ""),
        "artist_genres": track.get("_artist_genres", []),
        "album_genres": track.get("_album_genres", []),
        "audio_features": track.get("_audio_features", {}),
        "breakdowns": breakdowns,
    }


class RefineSource(BaseModel):
    source: str
    playlist_id: str | None = None
    album_id: str | None = None


class RefineAnalyzeBody(BaseModel):
    metric: str
    sources: list[RefineSource]


@router.post("/analyze")
async def analyze(request: Request, body: RefineAnalyzeBody):
    session_id = _get_session_id(request)
    if not session_id:
        return Response(status_code=401)

    configs = get_metric_full_configs()
    if body.metric not in configs:
        return Response(status_code=400, content=f"Unknown metric: {body.metric}")

    metric_cfg = configs[body.metric]

    async def generate():
        # 1. Fetch tracks from all sources
        yield _sse_event({"step": "fetching", "progress": 0, "total": 0, "message": "Fetching tracks..."})

        all_tracks: list[dict] = []
        for src in body.sources:
            _, tracks = await fetch_tracks_for_source(session_id, src.source, src.playlist_id, src.album_id)
            all_tracks.extend(tracks)

        # Deduplicate
        seen: set[str] = set()
        unique: list[dict] = []
        for t in all_tracks:
            if t["id"] not in seen:
                unique.append(t)
                seen.add(t["id"])

        total = len(unique)
        yield _sse_event({"step": "fetching", "progress": total, "total": total, "message": f"Fetched {total} tracks"})

        if not unique:
            yield _sse_event({"step": "error", "message": "No tracks found"})
            return

        # 2. Enrich
        yield _sse_event({"step": "enriching", "progress": 0, "total": 2, "message": "Fetching artist genres..."})
        genre_map = await enrich_artist_genres(session_id, unique)

        yield _sse_event({"step": "enriching", "progress": 1, "total": 2, "message": "Fetching audio features..."})
        audio_map = await enrich_audio_features(unique)

        attach_enrichment(unique, genre_map, {}, audio_map)

        # 3. Score with breakdowns
        yield _sse_event({"step": "scoring", "progress": 0, "total": total, "message": "Scoring tracks..."})

        track_results = []
        for i, track in enumerate(unique):
            breakdown = score_track_with_breakdown(track, body.metric)
            track_results.append((track, breakdown))
            if (i + 1) % 50 == 0 or i == len(unique) - 1:
                yield _sse_event(
                    {
                        "step": "scoring",
                        "progress": i + 1,
                        "total": total,
                        "message": f"Scoring tracks... {i + 1}/{total}",
                    }
                )

        # 4. Build analysis
        analysis = _build_analysis(body.metric, metric_cfg, track_results)
        yield _sse_event({"step": "done", "message": "Analysis complete", "analysis": analysis})

    return StreamingResponse(generate(), media_type="text/event-stream")


def _build_analysis(metric_name: str, metric_cfg: dict, track_results: list[tuple[dict, dict]]) -> dict:
    scores = [br["score"] for _, br in track_results]

    # Score histogram
    score_histogram = {label: 0 for label, _, _ in SCORE_BUCKETS}
    for s in scores:
        for label, lo, hi in SCORE_BUCKETS:
            if lo <= s <= hi:
                score_histogram[label] += 1
                break

    # Genre frequencies
    genre_counts: dict[str, int] = {}
    for track, _ in track_results:
        for g in track.get("_artist_genres", []):
            gl = g.lower()
            genre_counts[gl] = genre_counts.get(gl, 0) + 1
        for g in track.get("_album_genres", []):
            gl = g.lower()
            genre_counts[gl] = genre_counts.get(gl, 0) + 1

    primary_genres = set(metric_cfg.get("genres", {}).get("primary", []))
    subgenre_keywords = set(metric_cfg.get("subgenres", {}).get("keywords", []))

    genre_frequencies = []
    for genre, count in sorted(genre_counts.items(), key=lambda x: -x[1]):
        match_type = None
        if any(kw in genre for kw in primary_genres):
            match_type = "primary"
        elif any(kw in genre for kw in subgenre_keywords):
            match_type = "subgenre"
        genre_frequencies.append({"genre": genre, "count": count, "match_type": match_type})

    # Audio feature distributions
    boosted_features = {b["feature"]: b for b in metric_cfg.get("audio_boosts", [])}
    audio_features = {}
    for feat in AUDIO_FEATURE_NAMES:
        values = [t.get("_audio_features", {}).get(feat, 0) for t, _ in track_results]
        values = [v for v in values if v is not None]

        # Build histogram (10 bins for 0-1 features, different for loudness)
        if feat == "loudness":
            bins = [(-60, -50), (-50, -40), (-40, -30), (-30, -20), (-20, -10), (-10, 0)]
            histogram = {f"{lo} to {hi}": 0 for lo, hi in bins}
            for v in values:
                for lo, hi in bins:
                    if lo <= v < hi or (hi == 0 and v <= 0):
                        histogram[f"{lo} to {hi}"] += 1
                        break
        else:
            histogram = {}
            for i in range(10):
                lo = i / 10
                hi = (i + 1) / 10
                label = f"{lo:.1f}-{hi:.1f}"
                histogram[label] = sum(1 for v in values if lo <= v < hi or (i == 9 and v == 1.0))

        boost_info = boosted_features.get(feat)
        audio_features[feat] = {
            "histogram": histogram,
            "mean": round(statistics.mean(values), 3) if values else 0,
            "median": round(statistics.median(values), 3) if values else 0,
            "boosted": feat in boosted_features,
            "weight": boost_info["weight"] if boost_info else 0,
            "invert": boost_info.get("invert", False) if boost_info else False,
        }

    # Tempo distribution
    tempos = [t.get("_audio_features", {}).get("tempo", 0) for t, _ in track_results]
    tempos = [t for t in tempos if t > 0]
    tempo_bins = [(i, i + 20) for i in range(60, 260, 20)]
    tempo_histogram = {f"{lo}-{hi}": 0 for lo, hi in tempo_bins}
    for t in tempos:
        for lo, hi in tempo_bins:
            if lo <= t < hi:
                tempo_histogram[f"{lo}-{hi}"] += 1
                break

    # Per-track breakdowns (cap at 500, sorted by score desc)
    sorted_results = sorted(track_results, key=lambda x: -x[1]["score"])
    tracks_out = []
    for track, breakdown in sorted_results[:500]:
        artists = [a["name"] for a in track.get("artists", [])]
        album_images = track.get("album", {}).get("images", [])
        tracks_out.append(
            {
                "id": track["id"],
                "name": track.get("name", ""),
                "artists": artists,
                "album": track.get("album", {}).get("name", ""),
                "album_image": album_images[-1]["url"] if album_images else "",
                "score": breakdown["score"],
                "breakdown": breakdown,
                "artist_genres": track.get("_artist_genres", []),
                "album_genres": track.get("_album_genres", []),
                "audio_features": track.get("_audio_features", {}),
            }
        )

    return {
        "metric_name": metric_name,
        "metric_config": metric_cfg,
        "track_count": len(track_results),
        "score_histogram": score_histogram,
        "genre_frequencies": genre_frequencies,
        "audio_features": audio_features,
        "tempo": {
            "histogram": tempo_histogram,
            "mean": round(statistics.mean(tempos), 1) if tempos else 0,
            "median": round(statistics.median(tempos), 1) if tempos else 0,
            "ranges": metric_cfg.get("tempo", []),
        },
        "tracks": tracks_out,
    }
