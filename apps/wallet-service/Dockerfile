# ---- Stage 1: Deps ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json turbo.json ./
COPY apps/wallet-service/package.json ./apps/wallet-service/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-events/package.json ./packages/shared-events/
COPY packages/board-data/package.json ./packages/board-data/
RUN npm install --legacy-peer-deps --ignore-scripts

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cd packages/shared-types && npx tsc --outDir dist --declaration 2>/dev/null || true
RUN cd packages/shared-events && npx tsc --outDir dist --declaration 2>/dev/null || true
RUN cd packages/board-data && npx tsc --outDir dist --declaration 2>/dev/null || true
RUN cd apps/wallet-service && npx nest build

# ---- Stage 3: Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=builder --chown=nestjs:nodejs /app/apps/wallet-service/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

USER nestjs
EXPOSE ${PORT:-3001}

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
 CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main"]


