import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule, SchemaFactory, Prop, Schema } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpModule } from '@nestjs/axios';

import { GameController } from './game/game.controller';
import { GameActionsController } from './game/game-actions.controller';
import { GameEngineService } from './game/game-engine.service';
import { AntiCollusionService } from './anti-collusion/anti-collusion.service';
import { AntiCollusionGameProxy } from './anti-collusion/anti-collusion.proxy';
import { ChatService } from './chat/chat.service';
import { AdminService } from './admin/admin.service';
import { AdminController } from './admin/admin.controller';
import { EventBusService } from './event-bus/event-bus.service';
import { RedisService } from './redis/redis.service';

import { GameRecord } from './game/entities/game.entity';
import { ChatMessage } from './chat/entities/chat-message.entity';
import { UserBan } from './chat/entities/user-ban.entity';
import { JwtStrategy } from './guards/jwt.strategy';

// Mongoose schemas
import { SuspicionRecord, SuspicionRecordSchema } from './anti-collusion/schemas/suspicion-record.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    HttpModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get('DATABASE_URL'),
        entities: [GameRecord, ChatMessage, UserBan],
        synchronize: false,
        ssl: cfg.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        extra: { max: 15 },
      }),
    }),
    TypeOrmModule.forFeature([GameRecord, ChatMessage, UserBan]),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ uri: cfg.get('MONGODB_URI') }),
    }),
    MongooseModule.forFeature([
      { name: SuspicionRecord.name, schema: SuspicionRecordSchema },
    ]),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ secret: cfg.get('JWT_ACCESS_SECRET') }),
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),

    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ config: { url: cfg.get('REDIS_URL') } }),
    }),
  ],
  controllers: [GameController, GameActionsController, AdminController],
  providers: [
    GameEngineService,
    AntiCollusionService,
    AntiCollusionGameProxy,
    ChatService,
    AdminService,
    EventBusService,
    RedisService,
    JwtStrategy,
  ],
  exports: [GameEngineService, AntiCollusionGameProxy, ChatService, EventBusService],
})
export class AppModule {}
