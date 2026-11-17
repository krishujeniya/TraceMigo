# syntax=docker/dockerfile:1.4
# TraceMigo Unified Multi-Target Dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
WORKDIR /app

# Stage: api-builder
FROM base AS api-builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig*.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter "@tracemigo/api..."
COPY apps/api/ ./apps/api/
RUN pnpm --filter "@tracemigo/api" build

# Stage: api runtime
FROM node:22-alpine AS api
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production TRACEMIGO_HOST=0.0.0.0 TRACEMIGO_PORT=3001
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig*.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --prod --frozen-lockfile --filter "@tracemigo/api..."
COPY --from=api-builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
USER nodejs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:3001/v1/health/live || exit 1
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]

# Stage: web-builder
FROM base AS web-builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig*.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter "@tracemigo/web..."
COPY apps/web/ ./apps/web/
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN pnpm --filter "@tracemigo/web" build

# Stage: web runtime
FROM node:22-alpine AS web
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig*.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/
RUN pnpm install --prod --frozen-lockfile --filter "@tracemigo/web..."
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:3000/ || exit 1
WORKDIR /app/apps/web
CMD ["pnpm", "start"]
