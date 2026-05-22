import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

// ---- JWT Strategy ----
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET', 'test_secret_umukino'),
    });
  }
  async validate(payload: any) {
    if (!payload?.sub) throw new UnauthorizedException();
    return payload;
  }
}

// ---- JWT Auth Guard ----
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
