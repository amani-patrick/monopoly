# API Examples and Usage Guide

This guide provides practical examples for using all the new features.

## Table of Contents
1. [Google Authentication](#google-authentication)
2. [Anti-Collusion Monitoring](#anti-collusion-monitoring)
3. [Error Handling](#error-handling)
4. [RBAC Authorization](#rbac-authorization)
5. [Service-to-Service Communication](#service-to-service-communication)

---

## Google Authentication

### Example 1: Frontend Google Sign-In

```typescript
// On frontend (React/Vue example)
import { GoogleLogin } from '@react-oauth/google';

function LoginComponent() {
  const handleSuccess = async (credentialResponse) => {
    const response = await fetch('https://api.yourdomain.com/auth/google/authenticate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idToken: credentialResponse.credential,
        deviceFingerprint: {
          userAgent: navigator.userAgent,
          acceptLanguage: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen: { 
            width: window.screen.width, 
            height: window.screen.height 
          }
        }
      })
    });

    const { accessToken, refreshToken } = await response.json();
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.log('Login Failed')}
    />
  );
}
```

### Example 2: Backend Authorization Code Flow

```bash
# Exchange authorization code for tokens
curl -X POST https://api.yourdomain.com/auth/google/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AXRifzaLa...",
    "state": "security_token=138r5719ru3e1&url=https://yourdomain.com"
  }'

# Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Example 3: Link Google to Existing Account

```bash
curl -X POST https://api.yourdomain.com/auth/google/link \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "<google_id_token>"
  }'

# Response:
{
  "message": "Google account successfully linked"
}
```

### Example 4: Refresh Tokens

```bash
curl -X POST https://api.yourdomain.com/auth/google/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refresh_token>"
  }'

# Response:
{
  "accessToken": "new_access_token...",
  "refreshToken": "new_refresh_token..."
}
```

---

## Anti-Collusion Monitoring

### Example 1: Check if User in Shadow Pool

```bash
curl -X GET https://api.yourdomain.com/internal/anti-collusion/shadow-pool/user-123 \
  -H "x-internal-key: your-internal-secret"

# Response:
{
  "inShadowPool": true,
  "reason": "device_fingerprint_match",
  "addedAt": "2026-05-23T10:15:00Z",
  "expiresAt": "2026-06-22T10:15:00Z"
}
```

### Example 2: Analyze Player Patterns

```bash
curl -X GET https://api.yourdomain.com/internal/anti-collusion/analyze/user-456 \
  -H "x-internal-key: your-internal-secret"

# Response:
{
  "suspicious": true,
  "score": 72,
  "violations": [
    "repeated_asymmetric_trades",
    "high_pair_co_occurrence",
    "frequent_pair_trading"
  ],
  "details": {
    "tradeCount": 5,
    "averageAsymmetry": 0.38,
    "coOccurrenceRate": 0.82,
    "recentViolations": [
      {
        "type": "asymmetric_trade_completed",
        "score": 35,
        "timestamp": "2026-05-23T10:10:00Z"
      }
    ]
  }
}
```

### Example 3: Detect Collusion Rings

```bash
curl -X POST https://api.yourdomain.com/internal/anti-collusion/detect-ring \
  -H "x-internal-key: your-internal-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["user-1", "user-2", "user-3", "user-4"]
  }'

# Response:
{
  "detected": true,
  "ring": ["user-1", "user-2", "user-3"],
  "confidence": 0.87,
  "analysis": {
    "coOccurrenceMatrix": [
      ["user-1", "user-2", 8],
      ["user-1", "user-3", 7],
      ["user-2", "user-3", 9]
    ],
    "averageConnectivity": 0.82,
    "recommendedAction": "review_immediately"
  }
}
```

### Example 4: Review Suspicious Accounts Queue

```bash
curl -X GET https://api.yourdomain.com/internal/anti-collusion/review-queue \
  -H "x-internal-key: your-internal-secret"

# Response:
{
  "queue": [
    "user-123",
    "user-456:user-789",
    "user-101",
    "user-202:user-303"
  ],
  "total": 4,
  "oldestEntry": "2026-05-22T14:30:00Z"
}
```

### Example 5: Confirm Violation and Apply Shadow Pool

```bash
curl -X POST https://api.yourdomain.com/internal/anti-collusion/confirm-violation/user-123 \
  -H "x-internal-key: your-internal-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "violationType": "intentional_bankruptcy",
    "evidence": "Player intentionally lost money to beneficiary user-456 over 3 games",
    "reason": "Manual admin review confirmed collusion pattern"
  }'

# Response:
{
  "status": "confirmed",
  "userId": "user-123",
  "violationType": "intentional_bankruptcy",
  "addedToShadowPool": true,
  "shadowPoolExpires": "2026-06-22T10:15:00Z"
}
```

---

## Error Handling

### Example 1: Insufficient Balance Error

```bash
curl -X POST https://api.yourdomain.com/games/game-123/buy-property \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"propertyIndex": 1}'

# Response (400):
{
  "code": "GAME_INSUFFICIENT_BALANCE",
  "message": "Insufficient balance for this action",
  "details": {
    "required": 250000,
    "available": 150000,
    "deficit": 100000
  },
  "timestamp": "2026-05-23T10:30:00.000Z",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "path": "/games/game-123/buy-property",
  "statusCode": 400
}
```

### Example 2: Anti-Cheating Shadow Pool Error

```bash
curl -X POST https://api.yourdomain.com/rooms/123/join \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"entryFeeRwf": 50000}'

# Response (403):
{
  "code": "ANTICHEAT_SHADOW_POOL",
  "message": "Your account is under review for fair play violations",
  "details": {
    "reason": "repeated_asymmetric_trades",
    "reviewQueuePosition": 45,
    "estimatedReviewTime": "48 hours",
    "appealProcess": "https://yourdomain.com/support/appeal-account-status"
  },
  "timestamp": "2026-05-23T10:30:00.000Z",
  "traceId": "550e8400-e29b-41d4-a716-446655440001",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d480",
  "path": "/rooms/123/join",
  "statusCode": 403
}
```

### Example 3: Invalid Trade Error

```bash
curl -X POST https://api.yourdomain.com/games/game-123/initiate-trade \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetPlayerId": "player-456",
    "offer": {
      "properties": [],
      "cash": 0,
      "jailFreeCards": 0
    },
    "request": {
      "properties": [5, 15, 25],
      "cash": 200000,
      "jailFreeCards": 0
    }
  }'

# Response (400):
{
  "code": "GAME_TRADE_REJECTED",
  "message": "Trade rejected: highly asymmetric offer",
  "details": {
    "offerValue": 0,
    "requestValue": 600000,
    "ratio": 0.0,
    "fairnessThreshold": 0.60,
    "reason": "offer_too_low"
  },
  "timestamp": "2026-05-23T10:35:00.000Z",
  "traceId": "550e8400-e29b-41d4-a716-446655440002",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d481",
  "path": "/games/game-123/initiate-trade",
  "statusCode": 400
}
```

---

## RBAC Authorization

### Example 1: Check User Permissions

Backend code:
```typescript
import { RbacService, Permission, UserRole } from '@umukino/shared-types';

// In a game controller
if (!RbacService.hasPermission(userRole, Permission.GAME_END_EARLY)) {
  throw new ForbiddenException('You do not have permission to end games early');
}
```

### Example 2: Ban User (Admin Only)

```bash
curl -X POST https://api.yourdomain.com/admin/users/user-123/ban \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 2592000,
    "reason": "Confirmed collusion activity",
    "notes": "User involved in collusion ring with users 456 and 789"
  }'

# Response (200):
{
  "status": "success",
  "userId": "user-123",
  "bannedUntil": "2026-06-22T10:35:00Z",
  "reason": "Confirmed collusion activity"
}
```

### Example 3: Access Control on Resources

Backend code:
```typescript
import { RbacService, Permission, ResourceType } from '@umukino/shared-types';

// Can delete another user's account? (only admins)
const canDelete = RbacService.canAccessResource(
  userRole,
  targetUserId,  // resource owner
  currentUserId,  // who's asking
  Permission.USER_DELETE
);

if (!canDelete) {
  throw new ForbiddenException('Cannot delete this user');
}
```

### Example 4: Get All Permissions for Role

Backend code:
```typescript
import { RbacService, UserRole } from '@umukino/shared-types';

const adminPermissions = RbacService.getPermissions(UserRole.ADMIN);
console.log(adminPermissions);
// Output: [
//   'game:create', 'game:join', 'game:play', 'game:spectate',
//   'user:read', 'user:update', 'user:delete', 'user:ban', 'user:unban',
//   'wallet:read', 'wallet:withdraw', 'wallet:manage',
//   'transaction:refund', 'anticheat:review', 'anticheat:ban', 'anticheat:unban',
//   'chat:moderate', 'report:handle', 'report:escalate',
//   'config:read', 'config:update', 'audit:log:read', 'system:manage',
//   'content:create', 'content:edit', 'content:delete',
//   'room:create', 'room:manage', 'leaderboard:read', 'leaderboard:manage'
// ]
```

---

## Service-to-Service Communication

### Example 1: Call Game Service from Room Service

```typescript
import { ServiceClient } from '@umukino/shared-types';

@Injectable()
export class RoomService {
  constructor(
    private readonly serviceClient: ServiceClient,
    private readonly config: ConfigService,
  ) {}

  async initializeGame(roomId: string, players: Player[]): Promise<GameState> {
    const gameServiceUrl = this.config.get('GAME_SERVICE_URL');
    
    try {
      const gameState = await this.serviceClient.call<GameState>(
        gameServiceUrl,
        'POST',
        '/internal/games/init',
        {
          body: {
            roomId,
            players,
            settings: { /* settings */ },
          },
          headers: { 'x-room-key': 'secret-room-key' },
          timeout: 10000,
          retries: 3,
          // Correlation IDs are auto-added from request context
        }
      );
      
      return gameState;
    } catch (error) {
      this.logger.error(`Failed to initialize game for room ${roomId}:`, error);
      throw new InternalServerErrorException('Failed to create game');
    }
  }
}
```

### Example 2: Retry Configuration

```typescript
// Service call with custom retry logic
const result = await serviceClient.call<any>(
  walletServiceUrl,
  'POST',
  '/internal/transactions',
  {
    body: transactionData,
    timeout: 20000,  // Longer timeout for payment processing
    retries: 5,      // More retries for critical operations
    correlationId: requestContext.correlationId,
    internalKey: 'wallet-service-key',
  }
);
```

### Example 3: Request Tracing in Logs

All logs automatically include correlation IDs:

```
[550e8400-e29b-41d4-a716-446655440000] POST /games/123/trade START
[550e8400-e29b-41d4-a716-446655440000] Validating trade with anti-collusion service...
[550e8400-e29b-41d4-a716-446655440000] Service call to game-service succeeded (234ms)
[550e8400-e29b-41d4-a716-446655440000] POST /games/123/trade SUCCESS (456ms)
```

---

## Complete Request/Response Flow Example

### Scenario: User joins a paid game with anti-collusion checks

```
1. Frontend Request:
POST /rooms/123/join
Authorization: Bearer <user_token>
x-request-id: unique-req-id
x-correlation-id: trace-id-123
{
  "entryFeeRwf": 50000,
  "deviceFingerprint": { /* fingerprint */ }
}

2. API Gateway:
- Creates correlation context
- Validates JWT token
- Checks RBAC permissions (Permission.GAME_JOIN)
- Forwards to Room Service

3. Room Service:
- Checks room availability
- Calls Wallet Service to reserve funds
- Calls Anti-Collusion Service to verify player

4. Anti-Collusion Service:
- Checks shadow pool status
- Validates device fingerprint
- Checks network co-joining
- Returns clearance

5. Room Service:
- Adds player to room
- Calls Game Service if room full
- Returns success response

6. Response:
{
  "roomId": "123",
  "playerId": "player-456",
  "status": "joined",
  "gameState": { /* game data */ }
}
Headers:
x-correlation-id: trace-id-123
x-request-id: unique-req-id
x-response-time: 234ms
```

---

## Troubleshooting

### Debug Request Tracing

Find all logs for a request using correlation ID:
```bash
# In your log aggregation system (e.g., ELK Stack)
correlation_id: "550e8400-e29b-41d4-a716-446655440000"
```

### Check Anti-Collusion Scoring

```typescript
// See detailed scoring breakdown
const analysis = await antiCollusionService.analyzePlayerPatterns('user-123');
console.log(analysis);
// Output:
// {
//   suspicious: true,
//   score: 72,
//   violations: ['repeated_asymmetric_trades', 'high_pair_co_occurrence']
// }
```

### Test Bot Difficulty

```typescript
const botBrain = new BotBrain('aggressive');
const decision = botBrain.decide(gameState, botPlayer);
console.log(decision); // { action: 'buy', ... }
```

