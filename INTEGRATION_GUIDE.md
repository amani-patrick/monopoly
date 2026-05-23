# Integration Guide for Improvements

This guide shows how to integrate the improvements into existing modules and main application files.

## 1. API Gateway Integration

### Update `apps/api-gateway/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpModule } from '@nestjs/axios';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { GatewayController } from './gateway.controller';
import { JwtStrategy } from './guards/jwt-auth.guard';
import { GlobalExceptionFilter } from './guards/global-exception.filter';
import { CorrelationIdInterceptor } from './middleware/correlation-id.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 20  },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long',   ttl: 60000, limit: 300 },
    ]),

    HttpModule.register({ timeout: 15000, maxRedirects: 3 }),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_ACCESS_SECRET'),
      }),
    }),

    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [GatewayController],
  providers: [
    JwtStrategy,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
  ],
})
export class AppModule {}
```

## 2. Auth Service Integration

### Update `apps/auth-service/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { APP_FILTER } from '@nestjs/core';

import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { FirebaseGoogleAuthService } from './auth/firebase-google-auth.service';
import { GoogleAuthController } from './auth/controllers/google-auth.controller';
import { GlobalExceptionFilter } from './guards/global-exception.filter';

import { UserEntity } from './auth/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get('DATABASE_URL'),
        entities: [UserEntity],
        synchronize: false,
        ssl: cfg.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),

    TypeOrmModule.forFeature([UserEntity]),

    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        config: { url: cfg.get('REDIS_URL', 'redis://127.0.0.1:6379') },
      }),
    }),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_ACCESS_SECRET'),
      }),
    }),

    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    FirebaseGoogleAuthService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AuthModule {}
```

### Add Google Auth Routes to `apps/auth-service/src/auth/auth.controller.ts`

```typescript
// Already created in GoogleAuthController
// Just ensure it's registered in the app module above
```

## 3. Game Service Integration

### Update `apps/game-service/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule, SchemaFactory } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { APP_FILTER } from '@nestjs/core';

import { GameController } from './game/game.controller';
import { GameActionsController } from './game/game-actions.controller';
import { InternalBotController } from './game/internal-bot.controller';
import { GameEngineService } from './game/game-engine.service';
import { AntiCollusionService } from './anti-collusion/anti-collusion.service';
import { AntiCollusionGameProxy } from './anti-collusion/anti-collusion.proxy';
import { AntiCollusionListener } from './anti-collusion/anti-collusion.listener';
import { GlobalExceptionFilter } from './guards/global-exception.filter';

import { GameRecord } from './game/entities/game.entity';
import { ChatMessage } from './chat/entities/chat-message.entity';
import { SuspicionRecord, SuspicionRecordSchema } from './anti-collusion/schemas/suspicion-record.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get('DATABASE_URL'),
        entities: [GameRecord, ChatMessage],
        synchronize: false,
      }),
    }),

    TypeOrmModule.forFeature([GameRecord, ChatMessage]),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get('MONGODB_URL', 'mongodb://localhost:27017/monopoly'),
      }),
    }),

    MongooseModule.forFeature([
      { name: SuspicionRecord.name, schema: SuspicionRecordSchema },
    ]),

    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        config: { url: cfg.get('REDIS_URL', 'redis://127.0.0.1:6379') },
      }),
    }),
  ],
  controllers: [GameController, GameActionsController, InternalBotController],
  providers: [
    GameEngineService,
    AntiCollusionService,
    AntiCollusionGameProxy,
    AntiCollusionListener,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class GameModule {}
```

## 4. Bot Service Integration

### Update `apps/bot-service/src/bot/bot.service.ts` to use new difficulty

```typescript
// Change from:
// private readonly brain = new BotBrain('hard');

// To:
private readonly brain = new BotBrain(
  this.config.get('BOT_DIFFICULTY', 'aggressive') as BotDifficulty
);
```

## 5. Shared Types Update

### Update `packages/shared-types/src/index.ts`

```typescript
// Add exports for new types
export * from './api-responses';
export * from './rbac';
```

## 6. Update User Entity

### Ensure `apps/auth-service/src/auth/entities/user.entity.ts` has Google field

```typescript
import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('users')
@Index(['email'])
@Index(['googleUserId'])
export class UserEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ nullable: true })
  googleUserId: string;  // Add this field

  @Column({ default: 'player' })
  role: string;

  @Column({ default: true })
  isVerified: boolean;

  @Column({ default: false })
  isBanned: boolean;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  avatar: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## 7. Environment Variables

Add these to your `.env` or deployment configuration:

```env
# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/auth/google/callback

# Firebase
FIREBASE_CREDENTIALS='{"type":"service_account","project_id":"your-project",...}'

# Bot
BOT_DIFFICULTY=aggressive

# Redis
REDIS_URL=redis://localhost:6379

# MongoDB (for anti-collusion records)
MONGODB_URL=mongodb://localhost:27017/monopoly
```

## 8. Database Migrations

### Create migration for Google field

```sql
-- Migration: AddGoogleUserIdToUsers
ALTER TABLE users ADD COLUMN google_user_id VARCHAR(255) UNIQUE NULL;
CREATE INDEX idx_google_user_id ON users(google_user_id);
```

## 9. Testing Integration

### Update test configuration

```typescript
// In your test files, mock the new services:

const mockGoogleAuthService = {
  verifyAndAuthenticateWithGoogleIdToken: jest.fn(),
  exchangeGoogleAuthCode: jest.fn(),
  linkGoogleAccount: jest.fn(),
};

const mockAntiCollusionService = {
  detectCollusionRing: jest.fn(),
  checkDeviceLinking: jest.fn(),
  validateTrade: jest.fn(),
};
```

## 10. Deployment Checklist

- [ ] Update all environment variables in production
- [ ] Run database migrations for Google OAuth support
- [ ] Update GitHub/GitLab CI/CD to export environment variables
- [ ] Test Google Sign-In flow end-to-end
- [ ] Verify anti-collusion scoring works without blocking legitimate trades
- [ ] Test bot with aggressive difficulty
- [ ] Verify error responses don't leak sensitive information
- [ ] Check RBAC permissions for all existing endpoints
- [ ] Monitor correlation ID propagation in logs
- [ ] Load test service-to-service calls with retry logic

