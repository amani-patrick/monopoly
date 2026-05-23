#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker-compose >/dev/null 2>&1; then
  echo "ERROR: docker-compose is not installed or not on PATH."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Please edit .env if you need to change secrets or local URLs."
fi

echo "Starting local DB containers: postgres, mongodb, redis, minio..."
docker-compose up -d postgres mongodb redis minio

echo
echo "Waiting for containers to stabilize..."
docker-compose ps postgres mongodb redis minio

echo
cat <<'EOF'
Local DB containers are now starting.

Recommended next steps:
  1) Confirm .env — browser URLs use localhost; inter-service URLs use 127.0.0.1:
       DATABASE_URL=postgresql://umukino:umukino_dev_pw@127.0.0.1:5432/umukino
       MONGODB_URI=mongodb://umukino:umukino_dev_pw@127.0.0.1:27017/umukino?authSource=admin
       REDIS_URL=redis://127.0.0.1:6379
       AUTH_SERVICE_URL=http://127.0.0.1:3001
       API_GATEWAY_URL=http://127.0.0.1:4000
       NEXT_PUBLIC_API_URL=http://localhost:4000
       NEXT_PUBLIC_WS_URL=http://localhost:3003

  2) Install dependencies if needed:
       npm install

  3) Start backend services locally from separate terminals:
       npm --workspace=@umukino/auth-service run dev
       npm --workspace=@umukino/game-service run dev
       npm --workspace=@umukino/ws-gateway run dev
       npm --workspace=@umukino/wallet-service run dev
       npm --workspace=@umukino/room-service run dev
       npm --workspace=@umukino/leaderboard-service run dev
       npm --workspace=@umukino/notification-service run dev
       npm --workspace=@umukino/api-gateway run dev

  4) Start frontend locally:
       cd apps/web
       npm run dev

If you want to start just the DBs with npm:
  npm run db:local
EOF
