# Monopoly Platform Improvements - Comprehensive Enhancement Guide

## Overview
This document outlines comprehensive improvements made to the Monopoly richup.io clone platform covering anti-collusion, authentication, bot AI, error handling, and RBAC systems.

---

## 1. Enhanced Anti-Collusion System

### Key Improvements

#### 1.1 Advanced Detection Algorithms
- **Asymmetric Trade Analysis**: Graduated scoring based on trade fairness ratios
- **Collusion Ring Detection**: Graph-based analysis of player co-occurrences
- **Device Fingerprinting**: Multi-device linking detection to prevent multi-accounting
- **IP/ASN Analysis**: Network-based co-joining restriction with intelligent cooldowns

#### 1.2 New Detection Mechanisms

**Device Fingerprinting**
```typescript
// Tracks: User Agent, Language, Timezone, Screen Resolution
// Detects multi-account abuse from same device
// Score: +30-50 points for linked devices
```

**Collusion Ring Detection**
```typescript
// Builds co-occurrence graph between players
// Analyzes trading patterns within groups
// Detects organized collusion networks
// Confidence threshold: 75% co-occurrence rate
```

**Enhanced Trade Monitoring**
```typescript
// Tracks:
//   - Trade asymmetry (>40% difference triggers review)
//   - Pair trading frequency (3+ trades = review)
//   - Cash gifting rates (hourly limits enforced)
//   - Bankrupt-after-trade patterns
```

#### 1.3 Scoring System

**Immediate Ban Threshold**: 85 points
**Shadow Pool Threshold**: 65 points  
**Review Queue Threshold**: 40 points

Violation Score Mappings:
- Asymmetric Trade (blocked): 40-50 points
- Asymmetric Trade (completed): 20-40 points
- Device Fingerprint Match: 30-50 points
- Frequent Pair Trading: 20-50 points
- Intentional Bankruptcy: 45 points
- Network Co-join: 20 points
- High Co-occurrence: 35-45 points
- Excessive Gifting: 25 points

### API Endpoints

```bash
# Check if user in shadow pool
GET /anti-collusion/shadow-pool/{userId}

# Get collusion ring analysis
POST /anti-collusion/detect-ring
  body: { userIds: string[] }

# Analyze player patterns
GET /anti-collusion/analyze/{userId}

# Review suspicious accounts
GET /anti-collusion/review-queue
POST /anti-collusion/confirm-violation/{userId}
POST /anti-collusion/clear-violations/{userId}
```

---

## 2. Google Auth with Firebase Integration

### Key Features

#### 2.1 Authentication Flows

**ID Token Flow** (Frontend Google Sign-In)
```typescript
POST /auth/google/authenticate
{
  idToken: string,
  deviceFingerprint?: { userAgent, acceptLanguage, timezone, screen }
}
// Returns: { accessToken, refreshToken }
```

**Authorization Code Flow** (Backend OAuth)
```typescript
POST /auth/google/authorize
{
  code: string,
  state?: string
}
```

**Token Refresh**
```typescript
POST /auth/google/refresh
{
  refreshToken: string
}
```

#### 2.2 Account Linking

**Link Google to Existing Account**
```typescript
POST /auth/google/link
  (Requires JWT authentication)
{
  idToken: string
}
```

**Unlink Google Account**
```typescript
POST /auth/google/unlink
  (Requires JWT authentication)
```

#### 2.3 Session Management

**Verify Token Validity**
```typescript
POST /auth/google/verify-token
{
  accessToken: string
}
// Returns: { valid: boolean, email: string }
```

**Revoke Session**
```typescript
POST /auth/google/revoke
  (Requires JWT authentication)
```

### Implementation Details

**Firebase Admin SDK Integration**
- ID token verification with Firebase Auth
- Support for first-time user creation
- Automatic account linking for returning users
- Avatar import from Google profile

**Security Features**
- Token expiration validation
- Refresh token rotation support
- Session revocation capability
- Multi-account detection

### Environment Configuration

```env
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/auth/google/callback
FIREBASE_CREDENTIALS={"type":"service_account",...}
```

---

## 3. Advanced Bot Engine

### Difficulty Levels

#### 3.1 Aggressive Mode
- Minimum cash buffer: 2,000 RWF
- Aggressive property acquisition
- High auction bidding (1.5x market value)
- Fast jail escape
- Rapid building

**Tactics:**
- Buy almost any property if cash available
- Complete monopolies at any cost
- Block opponents aggressively
- Rush to build 4 houses/hotels

#### 3.2 Hard Mode (Default)
- Minimum cash buffer: 5,000 RWF
- Strategic monopoly focus
- Moderate auction bidding (1.2x market value)
- Tactical building
- Opponent threat analysis

**Tactics:**
- Prioritize monopoly completion
- Balanced risk/reward decisions
- Build when ahead
- Mortgage strategically when behind

#### 3.3 Strategic Mode
- Minimum cash buffer: 5,000 RWF
- Long-term planning
- Adaptive difficulty
- Risk analysis
- Optimal decision trees

### Decision Engine

**Buy Decision Logic**
```typescript
// Evaluates:
// 1. Monopoly completion value (highest priority)
// 2. Opponent threat level
// 3. Net worth comparison
// 4. Cash buffer requirements
// 5. Property scarcity
```

**Auction Bidding Strategy**
```typescript
// Increases bids for:
// 1. Completing monopolies
// 2. Properties with existing ownership
// 3. Strategic opportunities
// Limits to market value + percentage margin
```

**Building Strategy**
```typescript
// Prioritizes:
// 1. Complete monopolies only
// 2. High-rent properties first
// 3. Hotels when 4 houses on all properties
// 4. Rapid escalation if ahead
```

---

## 4. Structured Error Handling

### Error Codes

**General Errors**
- `BAD_REQUEST` - Invalid input/parameters
- `UNAUTHORIZED` - Missing/invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource already exists
- `INTERNAL_ERROR` - Server error

**Game-Specific Errors**
- `GAME_NOT_FOUND` - Game not found
- `GAME_INVALID_STATE` - Invalid game state transition
- `GAME_INVALID_TURN` - Wrong turn phase
- `GAME_INSUFFICIENT_BALANCE` - Not enough money
- `GAME_TRADE_REJECTED` - Trade failed validation

**Anti-Cheating Errors**
- `ANTICHEAT_SHADOW_POOL` - User in shadow pool
- `ANTICHEAT_MULTI_ACCOUNT` - Multi-accounting detected
- `ANTICHEAT_DEVICE_BANNED` - Device banned
- `ANTICHEAT_NETWORK_RESTRICTED` - Network restricted

### Error Response Format

```json
{
  "code": "GAME_INSUFFICIENT_BALANCE",
  "message": "Insufficient balance for this action",
  "details": {
    "required": 15000,
    "available": 8000,
    "deficit": 7000
  },
  "timestamp": "2026-05-23T10:30:00.000Z",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "path": "/api/games/g123/buy-property",
  "statusCode": 400
}
```

### Global Exception Filter

All exceptions are caught and formatted consistently:
- HTTP status codes properly mapped
- Request tracing with correlation IDs
- Detailed error logging
- Secure error messages (no internal details)
- Performance metrics included

---

## 5. Enhanced RBAC System

### Role Hierarchy

```
Super Admin (all permissions)
  ↓
Admin (full game/user management)
  ↓
Moderator (game moderation/reporting)
  ↓
Player (basic game access)
```

### Permission Matrix

**Player Permissions**
- `game:create` - Create game rooms
- `game:join` - Join public games
- `game:play` - Play in games
- `game:spectate` - Watch games
- `user:read` - View own profile
- `user:update` - Edit own profile
- `wallet:read` - View wallet
- `leaderboard:read` - View leaderboards

**Moderator Permissions**
- All Player permissions
- `chat:moderate` - Moderate chat
- `report:handle` - Process reports
- `user:ban` - Ban users (temporary)
- `anticheat:review` - Review suspicious accounts
- `audit:log:read` - View audit logs

**Admin Permissions**
- All Moderator permissions
- `user:delete` - Delete accounts
- `user:unban` - Unban users
- `anticheat:ban` - Ban users (permanent)
- `wallet:manage` - Manage wallets
- `transaction:refund` - Process refunds
- `config:update` - Change settings
- `room:manage` - Manage rooms
- `leaderboard:manage` - Manage leaderboards

**Super Admin Permissions**
- All permissions (unrestricted)

### Usage Examples

```typescript
// Check single permission
RbacService.hasPermission(UserRole.ADMIN, Permission.USER_BAN)

// Check multiple permissions
RbacService.hasAllPermissions(UserRole.MODERATOR, [
  Permission.CHAT_MODERATE,
  Permission.REPORT_HANDLE
])

// Resource-level access
RbacService.canAccessResource(
  userRole,
  resourceOwnerId,
  userId,
  Permission.USER_UPDATE
)

// Get all permissions for role
const perms = RbacService.getPermissions(UserRole.ADMIN)
```

---

## 6. Service-to-Service Communication

### Correlation ID Tracking

Every request gets:
```
x-correlation-id: UUID (shared across all service calls)
x-request-id: UUID (unique per request)
```

### Retry Logic

**Configuration**
- Max retries: 3
- Retry delay: 1000ms (exponential backoff)
- Request timeout: 15000ms
- Retryable errors: Network timeouts, connection refused

```typescript
// Service call with automatic retry
await serviceClient.call<GameState>(
  gameServiceUrl,
  'POST',
  '/games',
  {
    body: { roomId, players, settings },
    headers: { 'x-bot-key': botKey },
    retries: 3,
    timeout: 15000,
    correlationId,
    requestId,
  }
)
```

### Health Checks

```bash
# API Gateway
GET /health

# Auth Service
GET /health

# Game Service
GET /health

# Bot Service
(Passive Redis subscription, no HTTP endpoint)
```

---

## 7. Implementation Checklist

### Files Modified/Created

**Anti-Collusion**
- ✅ `apps/game-service/src/anti-collusion/anti-collusion.service.ts` - Enhanced
- ✅ `apps/game-service/src/anti-collusion/anti-collusion.proxy.ts` - Existing
- ✅ `apps/game-service/src/anti-collusion/anti-collusion.listener.ts` - Existing

**Authentication**
- ✅ `apps/auth-service/src/auth/firebase-google-auth.service.ts` - New
- ✅ `apps/auth-service/src/auth/controllers/google-auth.controller.ts` - New

**Bot Service**
- ✅ `apps/bot-service/src/bot/bot-brain.ts` - Completely rewritten

**Error Handling & Communication**
- ✅ `packages/shared-types/src/api-responses.ts` - New
- ✅ `apps/api-gateway/src/guards/global-exception.filter.ts` - New
- ✅ `apps/api-gateway/src/middleware/correlation-id.interceptor.ts` - New

**RBAC**
- ✅ `packages/shared-types/src/rbac.ts` - New

---

## 8. Configuration Updates

### Environment Variables

```env
# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://domain.com/auth/google/callback

# Firebase
FIREBASE_CREDENTIALS={"type":"service_account",...}

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Bot Difficulty
BOT_DIFFICULTY=aggressive|hard|strategic

# Service URLs
GAME_SERVICE_URL=http://game-service:3000
AUTH_SERVICE_URL=http://auth-service:3001
ROOM_SERVICE_URL=http://room-service:3002
WALLET_SERVICE_URL=http://wallet-service:3003
```

---

## 9. Testing Recommendations

### Anti-Collusion
- [ ] Test device fingerprinting with multiple devices
- [ ] Test collusion ring detection with 3-4 coordinated players
- [ ] Test shadow pool restrictions
- [ ] Verify async trade scoring

### Bot Engine
- [ ] Test aggressive mode early game strategy
- [ ] Test strategic building decisions
- [ ] Test jail escape logic
- [ ] Test auction bidding limits

### Error Handling
- [ ] Test all error codes return properly
- [ ] Verify correlation ID propagation
- [ ] Test retry logic with failing service
- [ ] Verify error responses don't leak internals

### RBAC
- [ ] Test permission checks for each role
- [ ] Test resource ownership validation
- [ ] Test admin override capability

---

## 10. Migration Guide

### For Frontend

**Google Sign-In Integration**
```typescript
// Get ID token from Google Sign-In
const idToken = await gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse(true).id_token;

// Send to backend
const response = await fetch('/auth/google/authenticate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ idToken })
});

const { accessToken, refreshToken } = await response.json();
```

### For Backend Services

**Error Handling**
```typescript
import { ApiError, ErrorCode } from '@umukino/shared-types';

// Throw structured errors
throw new ApiError(
  ErrorCode.GAME_INSUFFICIENT_BALANCE,
  400,
  'Insufficient balance for purchase',
  { required: 15000, available: 8000 }
);
```

**RBAC Checks**
```typescript
import { RbacService, Permission } from '@umukino/shared-types';

if (!RbacService.hasPermission(userRole, Permission.USER_BAN)) {
  throw new ForbiddenException('Insufficient permissions');
}
```

---

## 11. Performance Considerations

- Anti-collusion scoring is asynchronous and non-blocking
- Device fingerprinting uses Redis caching (90-day TTL)
- Collusion ring detection uses in-memory graph analysis
- Bot decisions cached for turn optimization
- Error responses serialized for minimal payload

---

## 12. Security Notes

- All service-to-service calls include internal keys
- Token expiration enforced
- Multi-account detection prevents fraud
- Device banning prevents abuse
- Audit logging enabled for admin actions
- Rate limiting applied per endpoint

