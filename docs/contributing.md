# Contributing

1. **Fork** the repo and clone your fork
2. **Setup:** `make setup` (creates `.env`, installs deps)
3. **Branch:** `git checkout -b my-feature`
4. **Develop:**
    - `make backend` — API at http://localhost:8000/docs
    - `make frontend` — UI at http://localhost:5173
    - Lint: `cd frontend && npm run lint`
    - Type-check: `cd frontend && npx tsc --noEmit`
5. **Commit** with a clear message and open a PR against `master`

## Guidelines

- One feature or fix per PR
- Follow existing code patterns
- New metrics only need a decorated function — see [Metrics](metrics.md#adding-your-own-metric)
- Update docs if you change user-facing behavior

## Where to Look

| Area              | Location                            |
|-------------------|-------------------------------------|
| API endpoints     | `backend/app/routers/`              |
| Scoring metrics   | `backend/app/services/scoring.py`   |
| Metric YAML files | `backend/app/metrics/`              |
| Queue logic       | `backend/app/services/queue.py`     |
| Track fetching    | `backend/app/services/tracks.py`    |
| Refine/inspect API| `backend/app/routers/refine.py`     |
| UI components     | `frontend/src/components/`          |
| Refine UI         | `frontend/src/components/Refine/`   |
| Player state      | `frontend/src/context/PlayerContext.tsx` |
| API client        | `frontend/src/api/spotify.ts`       |
