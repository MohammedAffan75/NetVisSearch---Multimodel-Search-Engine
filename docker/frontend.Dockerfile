# ─────────────────────────────────────────────────────────────────────────────
# frontend.Dockerfile — NetVisSearch React + Vite frontend
#
# Multi-stage build:
#   builder  → npm install + production build
#   runtime  → serve static files with nginx
#
# Build:
#   docker build -f docker/frontend.Dockerfile -t netvis-frontend:latest .
# Run locally:
#   docker run -p 80:80 netvis-frontend:latest
#
# NOTE: The frontend source is not scaffolded yet.
#       This Dockerfile is the cloud-ready template — fill in once
#       `frontend/` is initialised with `npm create vite@latest`.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copy package manifests first for cached installs
COPY frontend/package.json frontend/package-lock.json* ./

RUN npm ci --prefer-offline

# Copy the rest of the frontend source
COPY frontend/ .

# Vite production build — output goes to /app/dist
RUN npm run build


# ── Stage 2: nginx runtime ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: route all paths to index.html for client-side routing (React Router)
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Proxy API calls to the backend service\n\
    location /api/ {\n\
        proxy_pass http://backend:8000/;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
\n\
    # SPA fallback — all unknown paths return index.html\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
