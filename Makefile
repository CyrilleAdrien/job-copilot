.PHONY: setup up down logs ready models lint test test-db web

setup: ## Prépare le fichier .env et l'environnement Python de dev
	test -f .env || cp .env.example .env
	uv sync --all-packages
	cd web && npm ci

up: ## Construit et démarre toute la stack
	docker compose up -d --build

down: ## Arrête la stack (les données restent dans les volumes)
	docker compose down

logs:
	docker compose logs -f

ready: ## Affiche l'état de tous les services et de leurs dépendances
	curl -s http://127.0.0.1:$${GATEWAY_PORT:-8000}/ready | python3 -m json.tool

MODEL := $(or $(shell grep -s '^OLLAMA_MODEL=' .env | cut -d= -f2),qwen2.5:7b)

models: ## Télécharge le modèle LLM (environ 4,7 Go), dans Ollama natif si OLLAMA_URL le désigne
	@if grep -qs '^OLLAMA_URL=.*host.docker.internal' .env; then \
		ollama pull $(MODEL); \
	else \
		docker compose exec ollama ollama pull $(MODEL); \
	fi

lint:
	uv run ruff check .
	uv run ruff format --check .
	cd web && npm run lint && npm run typecheck

test-db: ## Postgres jetable pour les tests (port 5433)
	docker run -d --rm --name jobcopilot-test-db -p 5433:5432 \
		-e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=jobcopilot_test postgres:16-alpine

test: ## Nécessite `make test-db` une fois
	uv run pytest
	cd web && npm test

web: ## Lance le front en mode développement sur http://localhost:3000
	cd web && npm run dev
