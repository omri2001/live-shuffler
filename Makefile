.PHONY: run-docs run-backend run-frontend setup build-docs dev down clean

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

# Docker
dev:
	docker compose up --build

down:
	docker compose down

# Cleanup
clean:
	rm -rf frontend/node_modules backend/__pycache__ backend/app/__pycache__
