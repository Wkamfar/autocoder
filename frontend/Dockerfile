# syntax=docker/dockerfile:1.4
# Multi-stage build with optimized caching

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files
COPY package.json package-lock.json ./
COPY vite-wire.config.ts vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ./

# Copy source code
COPY src ./src
COPY public ./public
COPY index-wire.html index.html ./

# Build arguments for environment variables
ARG VITE_API_MODE=real
ARG VITE_API_BASE_URL
ARG VITE_AUTH_MODE=demo
ARG VITE_DEMO_USER_ID

# Set environment variables for build
ENV VITE_API_MODE=${VITE_API_MODE}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_AUTH_MODE=${VITE_AUTH_MODE}
ENV VITE_DEMO_USER_ID=${VITE_DEMO_USER_ID}
ENV NODE_ENV=production

# Build the app
# Cache bust: 2026-01-15 - Fixed TypeScript errors for beneficiary email confirmation
RUN npm run build

# Stage 3: Production
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist-wire /usr/share/nginx/html

# Nginx config: serve canonical /v2/* and redirect /wire/* -> /v2/*
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
