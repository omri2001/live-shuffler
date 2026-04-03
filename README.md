# Live Shuffler

A Spotify-powered web app that replaces random shuffle with intelligent, metric-based playback. Set weighted sliders for genres, language, mood, and tempo — and your queue reshuffles to match.

## Features

- **Smart Shuffle** — Weight metrics like Hip-Hop, Jazz, Chill, Dance, Metal, and more to control your queue mix
- **Multiple Sources** — Load from liked songs, playlists, or albums
- **Live Playback** — Full playback controls synced with Spotify
- **Pluggable Scoring** — Add new metrics with a single decorated function
- **Real-Time Progress** — SSE streaming shows loading progress as tracks are fetched and scored
- **Score Caching** — Persistent cache that auto-invalidates when scoring logic changes

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Backend  | Python 3.11+, FastAPI, httpx, uvicorn           |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Infra    | Docker Compose, uv (Python), npm (Node)         |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Python](https://www.python.org/) >= 3.11
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Docker](https://www.docker.com/) (optional, for containerized setup)
- A [Spotify Developer](https://developer.spotify.com/dashboard) app with a Client ID and Secret

## Quick Start

```bash
# Clone the repo
git clone https://github.com/definitelyOmri/live-shuffler.git
cd live-shuffler

# Run setup (creates .env, installs deps)
make setup

# Fill in your Spotify credentials
# Edit .env and set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET

# Start both services
make dev
```

Open http://localhost:5173 in your browser.

## Development

### Running Services Individually

```bash
make backend    # Backend on http://localhost:8000
make frontend   # Frontend on http://localhost:5173
```

### With Docker Compose

```bash
make dev        # Builds and starts both services
make down       # Stops services
```

### Available Make Commands

| Command        | Description                                  |
|----------------|----------------------------------------------|
| `make setup`   | Create `.env` from template, install all deps |
| `make dev`     | Start full stack via Docker Compose           |
| `make down`    | Stop Docker Compose services                  |
| `make backend` | Run backend directly (with hot-reload)        |
| `make frontend`| Run frontend directly (with hot-reload)       |
| `make install` | Install frontend and backend dependencies     |
| `make clean`   | Remove `node_modules` and `__pycache__`       |

## Project Structure

```
live-shuffler/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app setup
│   │   ├── config.py          # Environment config
│   │   ├── routers/           # API endpoints (auth, spotify, queue)
│   │   └── services/          # Business logic (scoring, queue, metadata)
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Main app component
│   │   ├── api/               # API client
│   │   ├── components/        # UI components
│   │   ├── context/           # Player state management
│   │   └── types/             # TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Adding a New Metric

The scoring system is pluggable. To add a new metric, create a single function in `backend/app/services/scoring.py`:

```python
@scorer("rock")
def score_rock(data: TrackData) -> int:
    if _genre_contains(data["artist_genres"], "rock"):
        return 80
    if _genre_contains(data["album_genres"], "rock"):
        return 60
    return 0
```

No other code changes needed — it auto-appears in the UI and all score outputs.

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b my-feature
   ```
3. **Set up your dev environment**:
   ```bash
   make setup
   ```
4. **Make your changes** and verify:
   - Backend: `make backend` and test endpoints at http://localhost:8000/docs
   - Frontend: `make frontend` and check the UI at http://localhost:5173
   - Lint frontend: `cd frontend && npm run lint`
   - Type-check frontend: `cd frontend && npx tsc --noEmit`
5. **Commit** with a clear message describing the change
6. **Open a Pull Request** against `master`

### Guidelines

- Keep PRs focused — one feature or fix per PR
- Follow existing code patterns and conventions
- New scoring metrics only need a decorated function (see [Adding a New Metric](#adding-a-new-metric))
- Update documentation if you change user-facing behavior

## Environment Variables

| Variable                | Required | Default                                      |
|------------------------|----------|----------------------------------------------|
| `SPOTIFY_CLIENT_ID`     | Yes      | —                                            |
| `SPOTIFY_CLIENT_SECRET`  | Yes      | —                                            |
| `SPOTIFY_REDIRECT_URI`   | No       | `http://localhost:8000/api/auth/callback`    |
| `FRONTEND_URL`           | No       | `http://localhost:5173`                      |
| `SECRET_KEY`             | No       | `change-me-to-a-random-secret`               |

## License

[MIT](LICENSE) — Omri Assa
