import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Admin or moderator — for anti-cheat review, not full platform admin. */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const role = ctx.switchToHttp().getRequest().user?.role;
    if (role !== 'admin' && role !== 'moderator') {
      throw new ForbiddenException('Staff access required');
    }
    return true;
  }
}
