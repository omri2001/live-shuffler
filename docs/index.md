# Live Shuffler

A Spotify-powered web app that replaces random shuffle with intelligent, metric-based playback.

Set weighted sliders for genres, language, mood, and tempo — and your queue reshuffles to match.

## Quick Start

```bash
git clone https://github.com/omri2001/live-shuffler.git
cd live-shuffler
make setup       # Creates .env, installs dependencies
# Edit .env with your Spotify credentials
make dev         # Start the app
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Learn More

- [Getting Started](getting-started.md) — Setup, configuration, and running the app
- [Metrics](metrics.md) — How each song metric is calculated
- [Architecture](architecture.md) — How the system works under the hood
- [Contributing](contributing.md) — How to contribute
