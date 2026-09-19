# ==============================================================================
# SELY MiniGame Hub — Multi-stage Dockerfile for Self-Hosted Deployment
# ==============================================================================

# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies needed for build)
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Build Vite client, Express server, and Vercel serverless bundle
RUN pnpm run build

# Prune devDependencies to keep runtime slim
RUN pnpm prune --prod

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container health checks
RUN apk add --no-cache curl

# Create persistent data directory for local SQLite database
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production artifacts and pruned node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/public ./client/public
COPY --from=builder /app/server/storage/schema ./server/storage/schema

# Set ownership to unprivileged user
USER node

# Expose HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/config || exit 1

# Start standalone server
CMD ["node", "dist/index.js"]
