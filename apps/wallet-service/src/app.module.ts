import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpModule } from '@nestjs/axios';
import { WalletController } from './wallet/wallet.controller';
import { WalletService } from './wallet/wallet.service';
import { WalletEntity, TransactionEntity } from './wallet/entities/wallet.entity';
import { MtnMomoProvider } from './providers/mtn-momo.provider';
import { AirtelMoneyProvider } from './providers/airtel-money.provider';
import { UsdtProvider } from './providers/usdt.provider';
import { JwtStrategy } from './guards/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    HttpModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get('DATABASE_URL'),
        entities: [WalletEntity, TransactionEntity],
        synchronize: false,
        ssl: cfg.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        extra: { max: 10 },
      }),
    }),
    TypeOrmModule.forFeature([WalletEntity, TransactionEntity]),
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
  controllers: [WalletController],
  providers: [WalletService, MtnMomoProvider, AirtelMoneyProvider, UsdtProvider, JwtStrategy],
})
export class AppModule {}

