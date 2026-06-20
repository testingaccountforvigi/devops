FROM node:20-alpine AS deps
WORKDIR /app
# Build context is the project root, so reference backend/ explicitly
COPY backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:20-alpine AS runtime
RUN apk add --no-cache netcat-openbsd
WORKDIR /app

# Copy installed deps from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the backend source files flat into /app
COPY backend/ .

# Copy the database seed so seed.js can reference it if needed
COPY database/ ./database/

RUN chmod +x ./docker-entrypoint.sh

RUN addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001 -G nodejs \
 && chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
