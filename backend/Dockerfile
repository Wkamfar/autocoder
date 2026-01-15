# syntax=docker/dockerfile:1.4
# Optimized multi-stage build with BuildKit cache mounts

# Stage 1: Dependencies and Prisma
FROM node:20-alpine AS deps
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install ALL dependencies (needed for Prisma generation)
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npm cache clean --force

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json tsconfig.json ./

# Install ALL dependencies for build
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npm cache clean --force

# Copy Prisma schema and generated client from deps stage
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/prisma ./prisma

# Copy source code
COPY src ./src

# Remove test files (they shouldn't be in source anyway, but just in case)
RUN find src -name "*.test.ts" -delete 2>/dev/null || true && \
    find src -name "*.spec.ts" -delete 2>/dev/null || true && \
    rm -f src/openapi/test-utils.ts src/openapi/mock-server.ts src/openapi/validate-spec.ts src/openapi/contract-tests.ts 2>/dev/null || true

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Copy dependencies.
# NOTE: We intentionally include devDependencies in the production image so the Prisma CLI
# is available for `prisma migrate deploy` during production deploys.
# (Otherwise the worker/back-end can start against an unmigrated DB and crash on missing tables.)
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npm cache clean --force

# Copy Prisma schema and generated client
COPY --from=deps /app/prisma ./prisma
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api/wire/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

CMD ["npm", "start"]
