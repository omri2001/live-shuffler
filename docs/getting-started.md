# Getting Started

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Python](https://www.python.org/) >= 3.11
- [uv](https://docs.astral.sh/uv/)
- A [Spotify Developer](https://developer.spotify.com/dashboard) app

## Spotify App Setup

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Set the redirect URI to `http://127.0.0.1:5173/api/auth/callback`
4. Note your **Client ID** and **Client Secret**

## Installation

```bash
git clone https://github.com/definitelyOmri/live-shuffler.git
cd live-shuffler
make setup
```

Edit `.env` and set your Spotify credentials:

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

## Running

```bash
make dev          # Docker Compose (backend + frontend)
# or run separately:
make backend      # http://localhost:8000
make frontend     # http://localhost:5173
```

## Make Commands

| Command        | Description                                  |
|----------------|----------------------------------------------|
| `make setup`   | Create `.env` from template, install all deps |
| `make dev`     | Start full stack via Docker Compose           |
| `make down`    | Stop Docker Compose services                  |
| `make backend` | Run backend directly (with hot-reload)        |
| `make frontend`| Run frontend directly (with hot-reload)       |
| `make docs`    | Serve documentation site locally              |
