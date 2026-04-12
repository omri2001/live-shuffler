.PHONY: run-docs run-backend run-frontend setup build-docs dev down clean test test-e2e test-all test-cov

# Run services
run-frontend:
	cd frontend && npm run dev

run-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

run-docs:
	uv run mkdocs serve -a localhost:8080

# Setup
setup:
	@test -f .env || cp .env.example .env && echo "Created .env from .env.example — fill in your Spotify credentials"
	cd frontend && npm install
	cd backend && uv sync

# Build
build-docs:
	uv run mkdocs build

# Test
test:
	cd backend && uv run pytest tests/unit/ tests/integration/ -v

test-e2e:
	cd backend && uv run pytest tests/e2e/ -m e2e -v

test-all:
	cd backend && uv run pytest tests/ -m "e2e or not e2e" -v

test-cov:
	cd backend && uv run pytest tests/ -m "e2e or not e2e" --cov=app --cov-report=term-missing

# Docker
dev:
	docker compose up --build

down:
	docker compose down

# Cleanup
clean:
	rm -rf frontend/node_modules backend/__pycache__ backend/app/__pycache__
