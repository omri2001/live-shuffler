.PHONY: dev down frontend backend install clean setup docs

dev:
	docker compose up --build

down:
	docker compose down

frontend:
	cd frontend && npm run dev

backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

install:
	cd frontend && npm install
	cd backend && uv sync

clean:
	rm -rf frontend/node_modules backend/__pycache__ backend/app/__pycache__

setup:
	@test -f .env || cp .env.example .env && echo "Created .env from .env.example — fill in your Spotify credentials"
	cd frontend && npm install
	cd backend && uv sync

docs:
	uv run mkdocs serve -a localhost:8080
