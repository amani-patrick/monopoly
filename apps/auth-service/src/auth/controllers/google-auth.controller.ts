import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Logger,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { FirebaseGoogleAuthService } from './firebase-google-auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthTokens } from '@umukino/shared-types';

/**
 * Google Authentication Controller
 * Handles all Google OAuth flows
 */
@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(private readonly googleAuth: FirebaseGoogleAuthService) {}

  /**
   * Authenticate with Google ID token
   * Frontend sends Google ID token obtained from Google Sign-In
   */
  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  async authenticateWithIdToken(
    @Body() body: { idToken: string; deviceFingerprint?: Record<string, any> },
  ): Promise<AuthTokens> {
    if (!body.idToken) {
      throw new BadRequestException('ID token is required');
    }

    this.logger.log('Google ID token authentication request received');
    return this.googleAuth.verifyAndAuthenticateWithGoogleIdToken(body.idToken);
  }

  /**
   * Exchange Google authorization code for tokens
   * Backend OAuth flow
   */
  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  async authorizeWithCode(
    @Body() body: { code: string; state?: string },
  ): Promise<AuthTokens> {
    if (!body.code) {
      throw new BadRequestException('Authorization code is required');
    }

    this.logger.log('Google authorization code exchange request received');
    return this.googleAuth.exchangeGoogleAuthCode(body.code);
  }

  /**
   * Refresh Google tokens
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Body() body: { refreshToken: string },
  ): Promise<AuthTokens> {
    if (!body.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    this.logger.log('Google token refresh request received');
    return this.googleAuth.refreshGoogleTokens(body.refreshToken);
  }

  /**
   * Verify Google access token validity
   */
  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  async verifyAccessToken(
    @Body() body: { accessToken: string },
  ): Promise<{ valid: boolean; email: string }> {
    if (!body.accessToken) {
      throw new BadRequestException('Access token is required');
    }

    const userInfo = await this.googleAuth.verifyGoogleAccessToken(body.accessToken);
    return { valid: true, email: userInfo.email };
  }

  /**
   * Link Google account to existing authenticated user
   */
  @Post('link')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async linkGoogleAccount(
    @Req() req: Request,
    @Body() body: { idToken: string },
  ): Promise<{ message: string }> {
    if (!body.idToken) {
      throw new BadRequestException('ID token is required');
    }

    const userId = (req.user as any)?.sub;
    if (!userId) {
      throw new BadRequestException('User context not found');
    }

    await this.googleAuth.linkGoogleAccount(userId, body.idToken);
    this.logger.log(`Google account linked for user ${userId}`);

    return { message: 'Google account successfully linked' };
  }

  /**
   * Unlink Google account from authenticated user
   */
  @Post('unlink')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unlinkGoogleAccount(@Req() req: Request): Promise<{ message: string }> {
    const userId = (req.user as any)?.sub;
    if (!userId) {
      throw new BadRequestException('User context not found');
    }

    await this.googleAuth.unlinkGoogleAccount(userId);
    this.logger.log(`Google account unlinked for user ${userId}`);

    return { message: 'Google account successfully unlinked' };
  }

  /**
   * Revoke Google session
   */
  @Post('revoke')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeSession(@Req() req: Request): Promise<{ message: string }> {
    const userId = (req.user as any)?.sub;
    if (!userId) {
      throw new BadRequestException('User context not found');
    }

    await this.googleAuth.revokeGoogleSession(userId);
    this.logger.log(`Google session revoked for user ${userId}`);

    return { message: 'Google session revoked' };
  }
}
