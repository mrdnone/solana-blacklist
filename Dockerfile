# ── Stage 1: build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: build Rust binary ────────────────────────────────────────────────
FROM rust:1.87-slim AS rust-builder
WORKDIR /app

# Install build deps for rusqlite (bundled) and reqwest (rustls, no openssl needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies — copy manifests first
COPY Cargo.toml Cargo.lock build.rs ./
COPY src/ ./src/

# Embed the source JSON files the build script needs
COPY src/sources/ ./src/sources/

RUN cargo build --release --bin api

# ── Stage 3: minimal runtime image ───────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary
COPY --from=rust-builder /app/target/release/api ./api

# Copy built frontend into the location the binary serves it from
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# DB and config live in a mounted volume at /data
ENV BLACKLIST_DB_PATH=/data/blacklist.db

EXPOSE 3000

CMD ["./api"]
