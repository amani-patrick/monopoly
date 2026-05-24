import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';

import { RoomEntity } from './room/entities/room.entity';
import { RoomController } from './room/room.controller';
import { RoomService } from './room/room.service';
import { XUserGuard } from './guards/x-user.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: [path.resolve(__dirname, '../../.env'), '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    HttpModule,
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: (cfg: ConfigService) => ({ type: 'postgres', url: cfg.get('DATABASE_URL'), entities: [RoomEntity], synchronize: false, extra: { max: 10 } }) }),
    TypeOrmModule.forFeature([RoomEntity]),
    
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ config: { url: cfg.get('REDIS_URL') } }),
    }),
  ],
  controllers: [RoomController],
  providers: [RoomService, XUserGuard],
})
export class AppModule {}
