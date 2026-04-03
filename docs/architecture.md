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
├── routers/             # API endpoints (auth, spotify, queue)
└── services/            # Business logic (scoring, queue, metadata)

frontend/src/
├── App.tsx              # Main layout
├── api/                 # API client with SSE support
├── context/             # Player state management (polling, sync)
├── components/          # UI (PlayerBar, Queue, GenreCircles, Library)
└── types/               # TypeScript interfaces
```

## Key Flows

**Authentication:** Frontend redirects to `/api/auth/login` → Spotify OAuth2 → callback exchanges code for tokens → session stored in JSON file → session ID sent to frontend via cookie.

**Loading tracks:** `/api/queue/add` streams progress via SSE. Tracks are enriched with artist/album genres (Spotify API, batches of 50) and audio features (ReccoBeats API, batches of 40), then scored across all metrics.

**Ranking:** Queue slots are allocated proportionally to metric weights. Each metric's slots are filled by its top-scoring tracks. Remaining slots get random tracks. Results are interleaved for variety.

**Score caching:** Scores are cached in `_score_cache.json` with an MD5 fingerprint of all scorer source code. Cache auto-invalidates when any scorer changes.
