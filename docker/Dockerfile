# ==============================================================================
# SELY MiniGame Hub — Multi-stage Dockerfile for Self-Hosted Deployment (Rust)
# ==============================================================================

# --- Stage 1: Frontend build (Vite + React) ---
FROM node:22-alpine AS frontend

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# publicDir (client/public) is copied into dist/public by Vite itself,
# so this stage's output already contains audio/textures/storage assets.
RUN pnpm run build

# --- Stage 2: Rust backend build (Axum standalone binary) ---
FROM rust:1-slim-bookworm AS backend

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends pkg-config && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release --bin standalone

# --- Stage 3: Production runtime ---
FROM debian:bookworm-slim AS runner

WORKDIR /app

ENV PORT=3000

# ca-certificates for rustls TLS (Turso, Redis, reqwest); curl for the healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --create-home --uid 1000 sely

RUN mkdir -p /app/data && chown -R sely:sely /app

COPY --from=backend /app/target/release/standalone ./standalone
COPY --from=frontend /app/dist/public ./dist/public

USER sely

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/config || exit 1

CMD ["./standalone"]
