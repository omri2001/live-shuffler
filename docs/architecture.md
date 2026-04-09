# Architecture

## Overview

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Frontend   │──API──│   Backend    │──API──│   Spotify    │
│  React/Vite  │       │   FastAPI    │       │   Web API    │
│  :5173       │       │   :8000      │       └─────────────┘
└─────────────┘       └──────┬──────┘
                              └── ReccoBeats API (audio features)
```

**Backend** (FastAPI): Handles Spotify auth, track metadata enrichment, scoring, and queue management. No database — sessions and score cache are stored as JSON files.

**Frontend** (React + TypeScript + Vite): Player UI with metric sliders, queue panel, and playback controls. Polls the backend every 3s to stay in sync with Spotify.

## Project Structure

```
backend/app/
├── main.py              # App setup, CORS, routers
├── config.py            # Env vars, Spotify URLs
├── metrics/             # Metric YAML definitions (one file per metric)
├── routers/
│   ├── auth.py          # Spotify OAuth2
│   ├── spotify.py       # Player, playlists, albums, seek
│   ├── queue.py         # Queue management, scoring, sync
│   └── refine.py        # Metric analysis and track inspection
└── services/
    ├── scoring.py       # Metric engine (YAML loader + scorers)
    ├── queue.py         # Queue state management
    ├── metadata.py      # Artist genres, audio features enrichment
    ├── tracks.py        # Shared track fetching from Spotify sources
    ├── score_cache.py   # Per-metric score caching with fingerprints
    ├── spotify.py       # Spotify API client with token refresh
    └── reccobeats.py    # ReccoBeats audio features client

frontend/src/
├── App.tsx              # Main layout, settings state, modals
├── api/spotify.ts       # API client with SSE support
├── context/PlayerContext.tsx  # Startup flow, polling, Spotify sync
├── components/
│   ├── Auth/            # Login button
│   ├── GenreCircles/    # Metric circles (carousel/grid/favorites)
│   ├── PlayerBar/       # Playback controls, progress, track scores
│   ├── Queue/           # Queue panel with re-score
│   ├── Library/         # Source picker (liked, playlists, albums)
│   ├── Refine/          # Metric analysis and track inspector
│   ├── Settings/        # Layout, queue size, theme
│   └── Stats/           # Score distribution charts
└── types/               # TypeScript interfaces
```

## Key Flows

### Startup

1. Frontend checks Spotify for currently playing track, shows it in the player immediately
2. Checks if queue has sources (page refresh case) — if so, done
3. Otherwise auto-loads liked songs via SSE, with a centered spinner showing progress
4. If Spotify had a track playing, the backend puts it at the front of the queue (enriched and scored)
5. Polling starts only after startup completes

### Spotify Sync

The poll (every 3s) detects when the playing track changes externally (e.g., user changed song in Spotify). When detected, calls `POST /api/queue/sync-current` which fetches, enriches, scores the track and inserts it at the front of the queue.

### Loading Tracks

`POST /api/queue/add` streams progress via SSE. Tracks are enriched with artist genres (Spotify API, batches of 50) and audio features (ReccoBeats API, batches of 40), then scored across all metrics.

### Ranking

Queue slots are allocated proportionally to metric weights. Each metric's slots are filled by its top-scoring tracks. Remaining slots get random tracks. Results are interleaved for variety.

### Score Caching

Scores are cached in `_score_cache.json` with per-metric MD5 fingerprints based on each metric's YAML content. Editing one YAML file only invalidates that metric's cached scores — other metrics are preserved. The "Re-score" button in the queue panel forces a full re-score of all loaded tracks.

### Refine Tool

`POST /api/refine/analyze` takes a metric name and list of sources, fetches and enriches all tracks, scores each with a detailed breakdown, then aggregates into histograms, genre frequencies, and audio feature distributions. `GET /api/refine/inspect/{track_id}` returns per-metric breakdowns for a single track.
