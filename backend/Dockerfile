# =============================================================
#  LoanPro — Backend Dockerfile
#  Build context: project root  (docker-compose sets context: .)
#  so we can reach database/seed.js from here.
# =============================================================

# -------------------------------------------------------------
# Stage 1 — deps
#   Install only production dependencies.
#   Keeping this in a separate stage means the final image never
#   contains npm cache or dev tooling.
# -------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only the manifest files first — maximises layer cache.
# If package.json hasn't changed, Docker reuses the cached layer.
COPY backend/package*.json ./

# ci is faster than install and uses the lock file exactly
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force


# -------------------------------------------------------------
# Stage 2 — runtime
# -------------------------------------------------------------
FROM node:20-alpine AS runtime

# netcat-openbsd → nc used in entrypoint to poll MySQL port
RUN apk add --no-cache netcat-openbsd

WORKDIR /app

# Pull in the trimmed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy backend application source
COPY backend/ ./

# Copy seed script (lives outside backend/ in the project root)
COPY database/seed.js ./seed.js

# Make the entrypoint executable while still root
RUN chmod +x ./docker-entrypoint.sh

# ------------------------------------------------------------------
# Security: run as a non-root user
# ------------------------------------------------------------------
RUN addgroup -g 1001 -S nodejs \
 && adduser  -S nodejs -u 1001 -G nodejs \
 && chown -R nodejs:nodejs /app

USER nodejs

# Port the Express server listens on
EXPOSE 3000

# Healthcheck — Docker marks the container unhealthy if this fails
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
