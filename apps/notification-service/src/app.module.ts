import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpModule } from '@nestjs/axios';



import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { XUserGuard } from './guards/x-user.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    HttpModule,
    
    
    
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ config: { url: cfg.get('REDIS_URL') } }),
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, XUserGuard],
})
export class AppModule {}
