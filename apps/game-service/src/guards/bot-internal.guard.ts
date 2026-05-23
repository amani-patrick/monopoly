import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotInternalGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['x-bot-key'] || req.headers['x-internal-key'];
    const expected = this.config.get('BOT_INTERNAL_KEY', 'bot-secret');
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal bot key');
    }
    return true;
  }
}
