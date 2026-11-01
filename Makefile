.PHONY: setup secret up down logs ready models lint test test-db web

setup: ## Prépare le fichier .env et l'environnement Python de dev
	test -f .env || cp .env.example .env
	$(MAKE) secret
	uv sync --all-packages
	cd web && npm ci

secret: ## Crée la clé de chiffrement SECRET_KEY dans .env si elle manque
	@grep -qs '^SECRET_KEY=..*' .env && echo "SECRET_KEY déjà présente" || { \
	  key=$$(openssl rand -hex 32); \
	  if grep -qs '^SECRET_KEY=' .env; then sed -i.bak "s/^SECRET_KEY=.*/SECRET_KEY=$$key/" .env && rm -f .env.bak; \
	  else echo "SECRET_KEY=$$key" >> .env; fi; \
	  echo "SECRET_KEY ajoutée à .env"; }

NATIVE_OLLAMA := $(shell grep -qs '^OLLAMA_URL=.*host.docker.internal' .env && echo yes)

up: secret ## Construit et démarre toute la stack (crée la clé de chiffrement si besoin)
	docker compose up -d --build
ifeq ($(NATIVE_OLLAMA),yes)
	@# Ollama natif : le conteneur ollama d'une version précédente ne doit plus tourner.
	@docker compose rm -sf ollama >/dev/null 2>&1 || true
endif

down: ## Arrête la stack (les données restent dans les volumes)
	docker compose --profile ollama down

logs:
	docker compose logs -f

ready: ## Affiche l'état de tous les services et de leurs dépendances
	curl -s http://127.0.0.1:$${GATEWAY_PORT:-8000}/ready | python3 -m json.tool

MODEL := $(or $(shell grep -s '^OLLAMA_MODEL=' .env | cut -d= -f2),qwen2.5:7b)

models: ## Télécharge le modèle LLM (environ 4,7 Go), dans Ollama natif si OLLAMA_URL le désigne
ifeq ($(NATIVE_OLLAMA),yes)
	ollama pull $(MODEL)
else
	docker compose exec ollama ollama pull $(MODEL)
endif

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
