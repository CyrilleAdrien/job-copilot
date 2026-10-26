.PHONY: setup up down logs ready models lint test web

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

models: ## Télécharge le modèle LLM dans Ollama (environ 4,7 Go)
	docker compose exec ollama ollama pull $${OLLAMA_MODEL:-qwen2.5:7b}

lint:
	uv run ruff check .
	uv run ruff format --check .
	cd web && npm run lint && npm run typecheck

test:
	uv run pytest
	cd web && npm test

web: ## Lance le front en mode développement sur http://localhost:3000
	cd web && npm run dev
