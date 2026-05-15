import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoomEntity } from './room/entities/room.entity';
import { RoomController } from './room/room.controller';
import { RoomService } from './room/room.service';
import { JwtStrategy } from './guards/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    HttpModule,
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: (cfg: ConfigService) => ({ type: 'postgres', url: cfg.get('DATABASE_URL'), entities: [RoomEntity], synchronize: false, extra: { max: 10 } }) }),
    TypeOrmModule.forFeature([RoomEntity]),
    
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
  controllers: [RoomController],
  providers: [RoomService, JwtStrategy],
})
export class AppModule {}
