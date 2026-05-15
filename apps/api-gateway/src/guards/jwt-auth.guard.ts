import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
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
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }
  async validate(payload: any) {
    if (!payload?.sub) throw new UnauthorizedException();
    return payload;
  }
}

// ---- JWT Auth Guard (re-export for convenience) ----
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// ---- Admin Guard ----
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (req.user?.role !== 'admin') throw new ForbiddenException('Admin access required');
    return true;
  }
}

// ---- Rate Limit Guard (uses NestJS ThrottlerGuard) ----
export { ThrottlerGuard as RateLimitGuard } from '@nestjs/throttler';
