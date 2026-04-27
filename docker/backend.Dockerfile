# ─────────────────────────────────────────────────────────────────────────────
# backend.Dockerfile — NetVisSearch API (FastAPI + Uvicorn)
#
# Multi-stage build:
#   builder  → install Python deps into a clean venv
#   runtime  → slim final image with only the venv and app code
#
# Build:
#   docker build -f docker/backend.Dockerfile -t netvis-backend:latest .
# Run locally:
#   docker run --env-file .env -p 8000:8000 netvis-backend:latest
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

# System deps needed to compile some packages (easyocr, torch wheels, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libgl1 \
        libglib2.0-0 \
        poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy only requirements first — maximises Docker layer cache reuse
COPY requirements.txt .

# Create a virtual environment and install deps into it
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Download the spaCy model so it's baked into the image
RUN /opt/venv/bin/python -m spacy download en_core_web_sm


# ── Stage 2: slim runtime image ───────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Runtime system libraries only
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy the pre-built venv from stage 1
COPY --from=builder /opt/venv /opt/venv

# Make venv binaries visible without activating
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Copy application source
COPY backend/ ./backend/
COPY .env.example .env.example

# Data & cache volumes — these should be mounted at runtime in production
VOLUME ["/app/data", "/app/model_cache"]

# Expose the API port (overridable via APP_PORT env var)
EXPOSE 8000

# Non-root user for security
RUN useradd -m -u 1001 netvis && chown -R netvis /app
USER netvis

# Health check — ECS / Docker Compose can use this
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

# Entrypoint: Uvicorn with reload in dev, 4 workers in prod
CMD ["sh", "-c", \
     "if [ \"$APP_ENV\" = 'production' ]; then \
        uvicorn backend.api:app --host 0.0.0.0 --port ${APP_PORT:-8000} --workers 4; \
      else \
        uvicorn backend.api:app --host 0.0.0.0 --port ${APP_PORT:-8000} --reload; \
      fi"]
