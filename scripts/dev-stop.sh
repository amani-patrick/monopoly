#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Stopping all development services..."

# Kill all npm dev processes
pkill -f "npm.*run dev" || true
sleep 1

# Stop docker containers
echo "Stopping database containers..."
docker-compose down

echo "Done! All services stopped."
