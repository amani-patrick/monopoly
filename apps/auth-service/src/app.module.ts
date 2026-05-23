import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { FirebaseAuthService } from './auth/firebase-auth.service';
import { XUserGuard } from './auth/guards/x-user.guard';
import { GoogleStrategy } from './auth/strategies/google.strategy';
import { UserEntity } from './auth/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get('DATABASE_URL'),
        entities: [UserEntity],
        synchronize: false, // use migrations in prod
        ssl: cfg.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        extra: { max: 10 },
      }),
    }),

    TypeOrmModule.forFeature([UserEntity]),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),

    PassportModule.register({}),

    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        config: { url: cfg.get('REDIS_URL', 'redis://127.0.0.1:6379') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthService, GoogleStrategy, XUserGuard],
})
export class AppModule {}
