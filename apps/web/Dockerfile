# ---- Stage 1: Deps ----
FROM node:20-alpine AS deps
WORKDIR /app

# In a monorepo, we need the root package files and ALL related package.json files
COPY package.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-events/package.json ./packages/shared-events/
COPY packages/board-data/package.json ./packages/board-data/

RUN npm install --legacy-peer-deps --ignore-scripts

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared packages first if they aren't pre-built
RUN cd packages/shared-types && npx tsc --outDir dist --declaration 2>/dev/null || true
RUN cd packages/shared-events && npx tsc --outDir dist --declaration 2>/dev/null || true
RUN cd packages/board-data && npx tsc --outDir dist --declaration 2>/dev/null || true

RUN cd apps/web && npm run build

# ---- Stage 3: Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone output includes everything needed to run
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
 CMD node -e "require('http').get('http://localhost:3000',r=>process.exit(r.statusCode<400?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
