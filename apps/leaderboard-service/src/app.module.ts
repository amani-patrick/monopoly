import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpModule } from '@nestjs/axios';

import { MongooseModule } from '@nestjs/mongoose';

import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { JwtStrategy } from './guards/jwt.strategy';
import { GameHistory, GameHistorySchema } from './schemas/game-history.schema';
import { PlayerStats, PlayerStatsSchema } from './schemas/player-stats.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    HttpModule,
    
    
    
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ uri: cfg.get('MONGODB_URI') }),
    }),
    MongooseModule.forFeature([
      { name: GameHistory.name, schema: GameHistorySchema },
      { name: PlayerStats.name, schema: PlayerStatsSchema },
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
  controllers: [LeaderboardController],
  providers: [LeaderboardService, JwtStrategy],
})
export class AppModule {}
