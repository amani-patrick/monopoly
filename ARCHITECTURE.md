# Umukino Architecture

## Overview

Umukino is a distributed multiplayer board game platform built as a microservice architecture. It uses a central API gateway, several specialized backend services, a WebSocket gateway for real-time gameplay, and a Next.js web client.

Key principles:
- Service isolation: each service owns a bounded domain and exposes a small public contract
- Event-driven updates: the game lifecycle publishes domain events through Redis pub/sub
- Shared schemas: common payload and event definitions live in `packages/shared-types` and `packages/shared-events`
- Real-time experience: game state and user actions are synchronized through the WS gateway

## Core services

### `apps/api-gateway`
- Entry point for all HTTP clients
- Routes requests to backend services using service discovery configuration
- Enforces authentication, rate limiting, and centralized error handling
- Exposes public REST endpoints for login, lobby, rooms, leaderboard, wallet, and admin actions

### `apps/auth-service`
- Manages user registration, login, refresh tokens, and social auth
- Issues JWTs used by the API gateway and WS gateway
- Validates password strength, account state, and ban/locked conditions

### `apps/room-service`
- Manages rooms and lobby lifecycle
- Creates, joins, leaves, and readies players for games
- Tracks room settings, entry fees, and prize distribution logic

### `apps/game-service`
- Contains the Monopoly game engine and business rules
- Runs the game state machine, turn processing, auctions, trades, and win conditions
- Publishes game events through Redis when state changes or a game finishes
- Includes anti-collusion checks to detect suspicious behavior

### `apps/ws-gateway`
- Handles real-time WebSocket connections from web clients
- Authenticates sockets with JWTs
- Proxies game and room actions to backend services and sends events back to clients
- Maintains connection state, room membership, and reconnection flow

### `apps/leaderboard-service`
- Consumes `game.finished` events to record game history and update player stats
- Exposes ranking endpoints for global leaderboards, win-rate leaderboards, and player history
- Caches leaderboard queries in Redis for performance and refreshes the cache after each completed game

### `apps/wallet-service`
- Handles deposits, withdrawals, balance inquiry, and fees
- Integrates with payment providers like MTN MoMo, Airtel Money, and USDT mocks
- Emits payment events for transparency and downstream processing

### `apps/notification-service`
- Sends notifications for lifecycle events and player updates
- Can be extended to support push, email, or in-app alerts

### `apps/bot-service`
- Drives AI players in bot-enabled rooms
- Contains leaderboard-style bot decision models and game heuristics

### `apps/web`
- Next.js client for players
- Uses Zustand for local and shared UI state
- Consumes the API gateway for authentication, room browsing, wallet, leaderboard, and game endpoints
- Connects to the WS gateway for real-time gameplay

## Shared libraries

### `packages/shared-types`
- Shared TypeScript models used across backend services and the web client
- Contains game state types, user payloads, wallet schemas, RBAC permissions, and common DTOs

### `packages/shared-events`
- Event names and pub/sub channel definitions
- Ensures consistent event payload types between publishers and consumers

## Data flow and runtime behavior

### Authentication flow
1. User registers or logs in through `/auth` via the API gateway
2. `auth-service` validates credentials and issues JWT access tokens
3. The client stores tokens locally and attaches them to subsequent requests
4. The API gateway authorizes requests using the JWT and forwards them to services

### Lobby / room flow
1. Client requests public rooms or creates a room through `room-service`
2. Players join the room and mark ready when ready to start
3. When all players are ready, `room-service` or `game-service` starts the game and publishes a game start event

### Real-time gameplay flow
1. Clients connect to `ws-gateway` using JWT-authenticated sockets
2. `ws-gateway` validates the user and assigns them to a game room
3. Gameplay actions are proxied to `game-service` or `room-service`
4. `game-service` updates the game state and publishes events over Redis
5. `ws-gateway` receives relevant events and broadcasts state updates to connected clients
6. UI components consume store updates and render the current board, player turns, auctions, and chat

### Leaderboard update flow
1. When a game completes, `game-service` publishes `GAME_EVENTS.GAME_FINISHED` to Redis
2. `leaderboard-service` subscribes to game events and receives the finished game payload
3. It records game history, updates player stats, computes win streaks, and invalidates cached leaderboards
4. Clients request leaderboards through the API gateway and receive fresh rankings from `leaderboard-service`

## Real-time and caching architecture

### Redis pub/sub
- Used as the event bus for game lifecycle events
- Services subscribe to channels such as `umukino:game-events`
- This decouples game execution from analytics, notifications, and leaderboard updates

### Redis cache
- Leaderboard queries are cached for fast reads
- Cache invalidation occurs after each `recordGameResult` to preserve freshness
- Cache TTLs limit stale data while reducing load on MongoDB

## UI state management

The web client uses a centralized Zustand store to manage:
- Authentication state (`currentUserId`, `currentUserName`, JWT token)
- Game connection state (`connected`, `gameOver`)
- Real-time UI state (`pendingCard`, `activeTrade`, `activeAuction`)
- Chat state and message history
- Global UI status flags (`loading`, `statusMessage`, `errorMessage`)

This makes the game UI more predictable across components and easier to extend with status indicators or global error handling.

## Error handling and user experience

- Backend services use NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.) to return meaningful API responses
- The API gateway propagates service errors consistently to the client
- The web client centralizes error extraction in `getErrorMsg()` and shows toast notifications for network and service failures
- Leaderboard and game pages display loading, error, and empty states explicitly for better UX

## Developer onboarding

### Running locally
- Use the mono-repo package manager scripts or existing `scripts/dev-local.sh` to launch services and dependencies
- Each backend service runs in `apps/<service>` and has a dedicated port
- Shared code is mounted via workspace references in `package.json`

### Service responsibilities
- `api-gateway`: HTTP entrypoint and proxy layer
- `auth-service`: user auth and token lifecycle
- `room-service`: lobby and room management
- `game-service`: game engine and event publisher
- `ws-gateway`: real-time websocket bridge
- `leaderboard-service`: ranking, history, and analytics
- `wallet-service`: payments and balances
- `notification-service`: in-app notifications
- `bot-service`: AI player engine

### Key files and directories
- `apps/web/src/store/game.store.ts`: shared frontend app state
- `apps/web/src/lib/api.ts`: HTTP client and error normalization
- `apps/leaderboard-service/src/leaderboard.service.ts`: leaderboard event processing and ranking cache
- `packages/shared-events/src/index.ts`: event names and Redis channels
- `packages/shared-types/src/index.ts`: shared DTOs and domain models

## Recommended extension points

- Add player history widgets in the UI with `leaderboard/players/:userId/history`
- Expose more game telemetry for analytics and anti-collusion review
- Add automated schema validation for event payloads in shared event definitions
- Add a service mesh or gateway-level tracing for cross-service request flow

## Summary

This system is built for real-time multiplayer game experience, with a strong separation between gameplay, persistence, authentication, and ranking. The event-driven leaderboard service is particularly useful because it decouples historical analytics from game execution while preserving live ranking accuracy.
