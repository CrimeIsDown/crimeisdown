FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /usr/local/bin/uv
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock ./
COPY backend/pyproject.toml backend/pyproject.toml
RUN uv sync --frozen --package app --no-dev --no-install-workspace
COPY backend backend
RUN uv sync --frozen --package app --no-dev
ENV PATH="/app/.venv/bin:$PATH" PYTHONPATH=/app/backend
WORKDIR /app/backend
USER www-data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
