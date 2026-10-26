# Image commune aux services Python. Construite depuis la racine du dépôt :
#   docker build -f services/Dockerfile --build-arg SERVICE=profile .
FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1

ARG SERVICE
ENV SERVICE=${SERVICE}
WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY libs ./libs
COPY services ./services
RUN uv sync --frozen --no-dev --package jobcopilot-${SERVICE}

RUN useradd --system --uid 1000 app
USER app
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD uvicorn jobcopilot_${SERVICE}.main:app --host 0.0.0.0 --port 8000
