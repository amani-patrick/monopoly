import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpModule } from '@nestjs/axios';
import * as path from 'path';
import { GatewayController } from './gateway.controller';
import { JwtStrategy } from './guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: [path.resolve(__dirname, '../../.env'), '.env'],
    }),

    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 20  },  // 20 req/sec
      { name: 'medium', ttl: 10000, limit: 100 },  // 100 req/10s
      { name: 'long',   ttl: 60000, limit: 300 },  // 300 req/min
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
  providers: [JwtStrategy],
})
export class AppModule {}
