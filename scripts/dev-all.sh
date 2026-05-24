#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Umukino Full Development Environment${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Check docker-compose
if ! command -v docker-compose >/dev/null 2>&1; then
  echo -e "${RED}ERROR: docker-compose is not installed or not on PATH.${NC}"
  exit 1
fi

# Check npm
if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}ERROR: npm is not installed or not on PATH.${NC}"
  exit 1
fi

# Setup .env if missing
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env from .env.example${NC}"
  else
    echo -e "${YELLOW}⚠ No .env.example found, skipping .env creation${NC}"
  fi
fi

# Load environment variables from .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo -e "${GREEN}✓ Environment variables loaded from .env${NC}"
fi

# Verify .env files in services
echo -e "${BLUE}Step 1: Verifying service .env files...${NC}"
SERVICES=("api-gateway" "auth-service" "bot-service" "game-service" "leaderboard-service" "notification-service" "payment-service" "room-service" "wallet-service" "web" "ws-gateway")

for service in "${SERVICES[@]}"; do
  if [ ! -f "apps/$service/.env" ]; then
    echo -e "${YELLOW}⚠ Missing apps/$service/.env${NC}"
  else
    echo -e "${GREEN}✓ apps/$service/.env exists${NC}"
  fi
done
echo

# Install dependencies
echo -e "${BLUE}Step 2: Installing dependencies...${NC}"
if npm install; then
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${YELLOW}⚠ npm install failed; retrying with --legacy-peer-deps...${NC}"
  if npm install --legacy-peer-deps; then
    echo -e "${GREEN}✓ Dependencies installed with --legacy-peer-deps${NC}"
  else
    echo -e "${RED}ERROR: npm install failed even with --legacy-peer-deps. Check logs and resolve dependency conflicts manually.${NC}"
    echo -e "${YELLOW}You can try running 'npm install --legacy-peer-deps' locally to inspect the error.${NC}"
  fi
fi
echo

# Start databases
echo -e "${BLUE}Step 3: Starting database containers...${NC}"
docker-compose up -d postgres mongodb redis minio
echo -e "${GREEN}✓ Database containers started${NC}"
echo

# Wait for health checks
echo -e "${BLUE}Step 4: Waiting for containers to be healthy...${NC}"
MAX_WAIT=120
ELAPSED=0
INTERVAL=5

while [ $ELAPSED -lt $MAX_WAIT ]; do
  POSTGRES=$(docker-compose exec -T postgres pg_isready -U umukino 2>/dev/null | grep "accepting connections" || true)
  MONGODB=$(docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" 2>/dev/null | grep -q "ok" && echo "1" || echo "0")
  REDIS=$(docker-compose exec -T redis redis-cli ping 2>/dev/null || echo "0")

  if [ -n "$POSTGRES" ] && [ "$REDIS" = "PONG" ]; then
    echo -e "${GREEN}✓ All containers are healthy${NC}"
    break
  fi
  
  echo "Waiting... (${ELAPSED}s/${MAX_WAIT}s)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo -e "${YELLOW}⚠ Container startup timeout, but proceeding...${NC}"
fi
echo

# Create logs directory
mkdir -p logs

# Start backend services in background
echo -e "${BLUE}Step 5: Starting backend services...${NC}"

declare -A PIDS

SERVICES_TO_START=(
  "auth-service"
  "game-service"
  "ws-gateway"
  "wallet-service"
  "room-service"
  "leaderboard-service"
  "notification-service"
  "api-gateway"
)

for service in "${SERVICES_TO_START[@]}"; do
  echo "Starting $service..."
  npm --workspace=@umukino/$service run dev > logs/${service}.log 2>&1 &
  PIDS[$service]=$!
  sleep 2
done

echo -e "${GREEN}✓ Backend services started (check logs/ directory for output)${NC}"
echo

# Start frontend
echo -e "${BLUE}Step 6: Starting frontend...${NC}"
npm --workspace=@umukino/web run dev > logs/web.log 2>&1 &
PIDS["web"]=$!

echo -e "${GREEN}✓ Frontend started${NC}"
echo

# Display status
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All services are starting!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo -e "${BLUE}Services Status:${NC}"
docker-compose ps
echo
echo -e "${BLUE}Logs:${NC}"
echo "  Backend services: logs/<service>.log"
echo "  Frontend: logs/web.log"
echo
echo -e "${BLUE}Running processes:${NC}"
ps aux | grep "npm.*run dev" | grep -v grep || echo "  (use 'ps aux | grep npm' to check)"
echo
echo -e "${YELLOW}To stop all services, run: npm run dev:stop${NC}"
echo
