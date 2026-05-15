# 🎲 UMUKINO — Rwanda Monopoly Platform

Real-money Monopoly-style board game platform built for Rwanda.


---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Docker Desktop or Docker + Docker Compose
- Node.js 20+ (for local package management)
- Git

### 1. Clone & configure
```bash
git clone https://github.com/amani-patrick/umukino.git
cd umukino
cp .env.example .env
# Edit .env if needed — defaults work for local dev
```

### 2. Start everything
```bash
docker compose up --build
```

This starts:
| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| API Gateway | http://localhost:4000 |
| WebSocket Gateway | http://localhost:3003 |
| Auth Service | http://localhost:3001 |
| Game Service | http://localhost:3002 |
| Wallet Service | http://localhost:3004 |
| Room Service | http://localhost:3005 |
| Leaderboard | http://localhost:3006 |
| PostgreSQL | localhost:5432 |
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |
| MinIO Console | http://localhost:9001 |

### 3. Pull pre-built images (after GitHub Actions ran)
```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u amani-patrick --password-stdin

# Pull all images
docker compose pull

# Run
docker compose up -d
```

---

## 🏗️ Architecture

```
apps/
  web/                → Next.js 14 frontend
  api-gateway/        → NestJS HTTP gateway (port 4000)
  ws-gateway/         → Socket.io WebSocket server (port 3003)
  auth-service/       → JWT + Google OAuth (port 3001)
  game-service/       → Monopoly game engine (port 3002)
  wallet-service/     → MTN MoMo / Airtel / USDT (port 3004)
  room-service/       → Lobbies, entry fees, prizes (port 3005)
  leaderboard-service/ → Rankings, stats (port 3006)
  notification-service/ → Email, push (port 3007)

packages/
  shared-types/       → TypeScript interfaces
  shared-events/      → WebSocket & Redis event constants
  board-data/         → Board spaces, card decks, game config
```

---

## 🎮 Game Features

- **40-space board**: Rwanda + international cities, airports, utilities
- **Real-time multiplayer**: Socket.io + Redis pub/sub, zero lag
- **2–8 players** per room
- **Full Monopoly rules**:
  - Roll dice, move, buy properties
  - Build houses → hotels (must build evenly across color group)
  - Pay rent (2× on full color sets)
  - Airport rent (scales 1→4 airports owned)
  - Utility rent (4× or 10× dice roll)
  - Mortgage / unmortgage properties
  - Go to jail: 3 doubles, card, landing on "Go to Prison"
  - Get out of jail: pay 5,000 RWF, use card, roll doubles
  - Trading between players (offer/counter/accept/reject)
  - Auction when player skips buying (optional toggle)
  - Bankruptcy on inability to pay debts
- **Rwanda-flavored cards**: 32 unique Surprise/Treasure cards in English + Kinyarwanda
- **Paid lobbies**: Entry fee (0–5,000,000 RWF), prize pool, 10% platform cut
- **Chat**: Real-time with profanity filter + strike system + auto-ban
- **Admin panel**: Hidden `/admin` routes, user/game/revenue management

---

## 💰 Payment Providers

| Provider | Mode | Status |
|---|---|---|
| MTN MoMo | `MTN_MOMO_MOCK=true` | Mocked (plug-and-play) |
| Airtel Money | `AIRTEL_MOCK=true` | Mocked (plug-and-play) |
| USDT | `USDT_MOCK=true` | Mocked (plug-and-play) |

To go live, set the relevant `_MOCK=false` and fill in credentials in `.env`.

---

## 🔑 Admin Access

Default admin: `admin@umukino.rw` / `Admin@12345`
**Change this immediately in production.**

Admin routes: `POST /admin/*` — requires JWT with `role: admin`.
Never exposed in frontend bundles.

---

## 🔄 CI/CD

Push to `main` → GitHub Actions automatically:
1. Lints and type-checks all packages
2. Runs unit tests with real Redis + Postgres
3. Builds all 9 Docker images in parallel
4. Pushes to `ghcr.io/amani-patrick/umukino/<service>:latest`
5. Generates deployment summary in Actions tab

Images are cached per service — only changed services rebuild.

---

## 🗂️ Environment Variables

See `.env.example` for all variables.
Critical ones for production:
- `JWT_ACCESS_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `JWT_REFRESH_SECRET` — same
- `POSTGRES_PASSWORD` — strong password
- All `_MOCK=false` flags when going live with payments

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, Tailwind, Socket.io client |
| API Gateway | NestJS, REST |
| WebSocket | NestJS, Socket.io |
| Game Engine | NestJS, Redis |
| Auth | NestJS, JWT, bcrypt, Passport Google |
| Database (ACID) | PostgreSQL 16 + TypeORM |
| Database (Game logs) | MongoDB 7 + Mongoose |
| Cache / Pub-Sub | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| Container Runtime | Docker, Docker Compose |
| CI/CD | GitHub Actions, GHCR |
