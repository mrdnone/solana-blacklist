# ── Stage 1: build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies — cached unless package-lock.json changes
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and production env (VITE_API_ORIGIN= so Swagger links are relative)
COPY frontend/ ./

# vite build picks up .env.production automatically
RUN npm run build

# ── Stage 2: build Rust binary ────────────────────────────────────────────────
FROM rust:1.87-slim AS rust-builder
WORKDIR /app

# rusqlite (bundled SQLite) needs a C linker; pkg-config for feature detection
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    pkg-config \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ── Dependency cache layer ──────────────────────────────────────────────────
# Fetch dependencies before copying the full source tree so this layer stays
# cached until Cargo manifests change.
COPY Cargo.toml Cargo.lock ./
RUN cargo fetch --locked

# ── Real build ──────────────────────────────────────────────────────────────
COPY build.rs ./
COPY src/ ./src/
RUN cargo build --release --bin api --locked

# ── Stage 3: minimal runtime image ───────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root
RUN useradd -r -s /bin/false appuser

WORKDIR /app

COPY --from=rust-builder /app/target/release/api ./api
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN chown -R appuser:appuser /app

# Data volume for the SQLite database
RUN mkdir -p /data && chown appuser:appuser /data
VOLUME ["/data"]

ENV BLACKLIST_DB_PATH=/data/blacklist.db

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/sources > /dev/null || exit 1

CMD ["./api"]
