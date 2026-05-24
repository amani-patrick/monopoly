cimport { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard
 * Verifies Bearer token in Authorization header
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
