# ── base ──────────────────────────────────────────────
FROM python:3.12-slim AS base

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY pyproject.toml uv.lock ./

# ── dev ───────────────────────────────────────────────
FROM base AS dev

RUN uv sync --frozen
COPY . .
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-exclude", ".venv"]

# ── prod ──────────────────────────────────────────────
FROM base AS prod

RUN uv sync --frozen --no-dev
COPY . .

RUN groupadd -r app && useradd -r -g app app
USER app

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
