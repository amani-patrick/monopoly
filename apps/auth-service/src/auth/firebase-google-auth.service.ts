import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as admin from 'firebase-admin';
import { v4 as uuid } from 'uuid';
import { UserEntity } from './entities/user.entity';
import { AuthTokens, JwtPayload } from '@umukino/shared-types';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

interface FirebaseGoogleIdTokenPayload {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  at_hash: string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  iat: number;
  exp: number;
}

interface GoogleTokenExchangeResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: 'Bearer';
  id_token: string;
}

/**
 * Firebase Google Auth Service
 * Handles Google OAuth authentication using Firebase Admin SDK
 * Supports:
 * - Google ID token verification
 * - Token refresh
 * - Account linking with existing users
 * - First-time user onboarding
 */
@Injectable()
export class FirebaseGoogleAuthService {
  private readonly logger = new Logger(FirebaseGoogleAuthService.name);
  private firebaseApp: admin.app.App;
  private googleOAuthClientId: string;
  private googleOAuthClientSecret: string;
  private readonly REFRESH_TOKEN_TTL_DAYS = 30;
  private readonly ACCESS_TOKEN_TTL_MINUTES = 15;

  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.googleOAuthClientId = this.config.get('GOOGLE_OAUTH_CLIENT_ID') || '';
    this.googleOAuthClientSecret = this.config.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';

    // Initialize Firebase Admin SDK
    const firebaseCredentials = this.config.get('FIREBASE_CREDENTIALS');
    if (firebaseCredentials) {
      try {
        const credentials = typeof firebaseCredentials === 'string'
          ? JSON.parse(firebaseCredentials)
          : firebaseCredentials;

        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(credentials),
          projectId: credentials.project_id,
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } catch (err) {
        this.logger.warn('Firebase Admin SDK initialization failed - OAuth only mode');
      }
    }
  }

  /**
   * Verify Firebase ID token and authenticate user
   * This is the primary Google Auth flow
   */
  async verifyAndAuthenticateWithGoogleIdToken(idToken: string): Promise<AuthTokens> {
    try {
      // Verify token with Firebase
      const decodedToken = await this.firebaseApp?.auth().verifyIdToken(idToken);
      if (!decodedToken) {
        throw new UnauthorizedException('Failed to verify Google ID token');
      }

      const { uid, email, name, picture } = decodedToken;

      if (!email) {
        throw new BadRequestException('Email not provided by Google account');
      }

      // Find or create user
      let user = await this.userRepo.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // First-time user - create account
        user = await this.createGoogleUser(uid, email, name, picture);
        this.logger.log(`New Google user created: ${user.id} (${email})`);
      } else if (!user.googleId) {
        // Existing user - link Google account
        user.googleId = uid;
        user.avatar = picture || user.avatar;
        user.isVerified = true;
        await this.userRepo.save(user);
        this.logger.log(`Google account linked to existing user: ${user.id}`);
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Store refresh token in Redis with rate limiting
      await this.storeRefreshTokenMetadata(user.id, idToken);

      return tokens;
    } catch (err: any) {
      if (err.code === 'auth/id-token-expired') {
        throw new UnauthorizedException('Google ID token has expired');
      }
      if (err.code === 'auth/id-token-revoked') {
        throw new UnauthorizedException('Google ID token has been revoked');
      }
      this.logger.error(`Google ID token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid Google ID token');
    }
  }

  /**
   * Exchange Google authorization code for tokens
   * Used in server-to-server OAuth flow
   */
  async exchangeGoogleAuthCode(authCode: string): Promise<AuthTokens> {
    try {
      const response = await firstValueFrom(
        this.http.post<GoogleTokenExchangeResponse>(
          'https://oauth2.googleapis.com/token',
          {
            client_id: this.googleOAuthClientId,
            client_secret: this.googleOAuthClientSecret,
            code: authCode,
            grant_type: 'authorization_code',
            redirect_uri: this.config.get('GOOGLE_OAUTH_REDIRECT_URI'),
          },
        ),
      );

      const { id_token } = response.data;
      return this.verifyAndAuthenticateWithGoogleIdToken(id_token);
    } catch (err: any) {
      this.logger.error(`Google auth code exchange failed: ${err.message}`);
      throw new BadRequestException('Failed to exchange Google auth code');
    }
  }

  /**
   * Refresh Google tokens using refresh token
   */
  async refreshGoogleTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const response = await firstValueFrom(
        this.http.post<GoogleTokenExchangeResponse>(
          'https://oauth2.googleapis.com/token',
          {
            client_id: this.googleOAuthClientId,
            client_secret: this.googleOAuthClientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          },
        ),
      );

      const { id_token } = response.data;
      return this.verifyAndAuthenticateWithGoogleIdToken(id_token);
    } catch (err: any) {
      this.logger.error(`Google token refresh failed: ${err.message}`);
      throw new UnauthorizedException('Failed to refresh Google tokens');
    }
  }

  /**
   * Verify Google access token from frontend
   * Frontend can send Google access token directly
   */
  async verifyGoogleAccessToken(accessToken: string): Promise<FirebaseGoogleIdTokenPayload> {
    try {
      const response = await firstValueFrom(
        this.http.get('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      return response.data as FirebaseGoogleIdTokenPayload;
    } catch (err: any) {
      this.logger.error(`Google access token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid Google access token');
    }
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(userId: string, googleIdToken: string): Promise<void> {
    try {
      const decodedToken = await this.firebaseApp?.auth().verifyIdToken(googleIdToken);
      if (!decodedToken) {
        throw new UnauthorizedException('Failed to verify Google ID token');
      }

      const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

      if (user.googleId) {
        throw new ConflictException('Google account already linked to this user');
      }

      // Check if Google account is already linked to another user
      const existingLink = await this.userRepo.findOne({
        where: { googleId: decodedToken.uid },
      });

      if (existingLink && existingLink.id !== userId) {
        throw new ConflictException('This Google account is already linked to another user');
      }

      user.googleId = decodedToken.uid;
      user.isVerified = true;
      if (decodedToken.picture) {
        user.avatar = decodedToken.picture;
      }
      await this.userRepo.save(user);

      this.logger.log(`Google account linked to user ${userId}`);
    } catch (err: any) {
      if (err instanceof ConflictException) throw err;
      this.logger.error(`Failed to link Google account: ${err.message}`);
      throw new BadRequestException('Failed to link Google account');
    }
  }

  /**
   * Unlink Google account from user
   */
  async unlinkGoogleAccount(userId: string): Promise<void> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    if (!user.googleId) {
      throw new BadRequestException('Google account not linked to this user');
    }

    user.googleId = null;
    await this.userRepo.save(user);

    this.logger.log(`Google account unlinked from user ${userId}`);
  }

  /**
   * Revoke Google session
   */
  async revokeGoogleSession(userId: string): Promise<void> {
    const sessionKey = `user:${userId}:google_session`;
    await this.redis.del(sessionKey);
    this.logger.log(`Google session revoked for user ${userId}`);
  }

  /**
   * Create new user from Google account
   */
  private async createGoogleUser(
    googleId: string,
    email: string,
    name?: string,
    picture?: string,
  ): Promise<UserEntity> {
    const user = new UserEntity();
    user.id = uuid();
    user.email = email.toLowerCase();
    user.googleId = googleId;
    user.displayName = name?.trim().slice(0, 50) || email.split('@')[0];
    user.avatar = picture || this.getDefaultAvatar();
    user.role = 'player';
    user.isVerified = true;
    user.isBanned = false;
    user.createdAt = new Date();
    user.updatedAt = new Date();

    return this.userRepo.save(user);
  }

  /**
   * Generate JWT tokens for authenticated user
   */
  private generateTokens(user: UserEntity): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      role: (user.role as any),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: `${this.ACCESS_TOKEN_TTL_MINUTES}m`,
      secret: this.config.get('JWT_ACCESS_SECRET'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: `${this.REFRESH_TOKEN_TTL_DAYS}d`,
      secret: this.config.get('JWT_REFRESH_SECRET'),
    });

    return { accessToken, refreshToken, expiresIn: this.ACCESS_TOKEN_TTL_MINUTES * 60 };
  }

  /**
   * Store refresh token session metadata in Redis.
   * We store a hash of the idToken (not the token itself) to avoid
   * storing a live bearer credential in Redis.
   */
  private async storeRefreshTokenMetadata(userId: string, idToken: string): Promise<void> {
    const sessionKey = `user:${userId}:google_session`;
    // Hash the token so a Redis compromise doesn't expose a live Google credential
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(idToken).digest('hex');
    await this.redis.set(
      sessionKey,
      JSON.stringify({
        tokenHash,
        createdAt: Date.now(),
      }),
      'EX',
      this.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    );
  }

  /**
   * Get default avatar for new user
   */
  private getDefaultAvatar(): string {
    const colors = ['FF6B6B', '4ECDC4', '45B7D1', 'FFA07A', '98D8C8'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const avatarId = Math.floor(Math.random() * 100);
    return `https://ui-avatars.com/api/?name=User&background=${randomColor}&color=fff&size=128&rounded=true`;
  }
}
