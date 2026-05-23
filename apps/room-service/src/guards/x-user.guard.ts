import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '@umukino/shared-types';

@Injectable()
export class XUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-user'];
    if (!header || typeof header !== 'string') {
      throw new UnauthorizedException('Missing x-user header');
    }

    try {
      const user = JSON.parse(header) as JwtPayload;
      req.user = user as any;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid x-user header');
    }
  }
}
