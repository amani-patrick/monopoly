import {
  Injectable, Logger, UnauthorizedException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { UserEntity } from './entities/user.entity';
import { AuthTokens, JwtPayload } from '@umukino/shared-types';

const SALT_ROUNDS = 12;
const REFRESH_TTL_DAYS = 30;
const ACCESS_TTL_MINUTES = 15;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ============================================================
  // REGISTER
  // ============================================================

  async register(email: string, password: string, displayName: string): Promise<AuthTokens> {
    const existing = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    this.validatePassword(password);

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.userRepo.save({
      id: uuid(),
      email: email.toLowerCase(),
      passwordHash: hash,
      displayName: displayName.trim().slice(0, 30),
      avatar: this.randomAvatar(),
      role: 'player',
      isVerified: false,
      isBanned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`New user registered: ${user.id} (${user.email})`);
    return this.generateTokens(user);
  }

  // ============================================================
  // LOGIN
  // ============================================================

  async login(email: string, password: string): Promise<AuthTokens> {
    const lockKey = `auth:lock:${email.toLowerCase()}`;
    const locked = await this.redis.get(lockKey);
    if (locked) throw new UnauthorizedException(`Account locked. Try again in ${LOCKOUT_MINUTES} minutes.`);

    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      await this.incrementFailedLogins(email, lockKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBanned) throw new UnauthorizedException('Your account has been banned. Contact support.');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.incrementFailedLogins(email, lockKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Clear failed attempts on success
    await this.redis.del(`auth:fails:${email.toLowerCase()}`);
    await this.redis.del(lockKey);

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    return this.generateTokens(user);
  }

  // ============================================================
  // GOOGLE OAUTH
  // ============================================================

  async handleGoogleAuth(googleUser: {
    googleId: string;
    email: string;
    displayName: string;
    picture: string;
  }): Promise<AuthTokens> {
    let user = await this.userRepo.findOne({ where: { googleId: googleUser.googleId } });

    if (!user) {
      // Check if email already registered manually
      const existing = await this.userRepo.findOne({ where: { email: googleUser.email.toLowerCase() } });
      if (existing) {
        // Link Google account to existing user
        await this.userRepo.update(existing.id, { googleId: googleUser.googleId, avatar: googleUser.picture });
        user = { ...existing, googleId: googleUser.googleId };
      } else {
        // Create new user
        user = await this.userRepo.save({
          id: uuid(),
          email: googleUser.email.toLowerCase(),
          googleId: googleUser.googleId,
          displayName: googleUser.displayName.trim().slice(0, 30),
          avatar: googleUser.picture,
          role: 'player',
          isVerified: true, // Google verifies email
          isBanned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (user.isBanned) throw new UnauthorizedException('Account banned');
    return this.generateTokens(user);
  }

  // ============================================================
  // TOKEN MANAGEMENT
  // ============================================================

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify(refreshToken, { secret: this.config.get('JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if refresh token is blacklisted (logged out)
    const blacklisted = await this.redis.get(`auth:blacklist:${refreshToken.slice(-20)}`);
    if (blacklisted) throw new UnauthorizedException('Token revoked');

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.isBanned) throw new UnauthorizedException('User not found or banned');

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    // Blacklist the refresh token
    await this.redis.set(
      `auth:blacklist:${refreshToken.slice(-20)}`,
      '1',
      'EX', REFRESH_TTL_DAYS * 86400,
    );
  }

  async validateAccessToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwt.verify(token, { secret: this.config.get('JWT_ACCESS_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  // ============================================================
  // PROFILE
  // ============================================================

  async getProfile(userId: string): Promise<Omit<UserEntity, 'passwordHash' | 'googleId'>> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const { passwordHash, googleId, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, updates: { displayName?: string; avatar?: string }): Promise<void> {
    const patch: Partial<UserEntity> = { updatedAt: new Date() };
    if (updates.displayName) patch.displayName = updates.displayName.trim().slice(0, 30);
    if (updates.avatar) patch.avatar = updates.avatar;
    await this.userRepo.update(userId, patch);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    if (!user.passwordHash) throw new BadRequestException('Account uses social login');
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    this.validatePassword(newPassword);
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.update(userId, { passwordHash: hash, updatedAt: new Date() });
  }

  // ============================================================
  // ADMIN
  // ============================================================

  async banUser(userId: string, reason: string): Promise<void> {
    await this.userRepo.update(userId, { isBanned: true, banReason: reason, updatedAt: new Date() });
    // Invalidate all sessions
    await this.redis.set(`auth:banned:${userId}`, '1', 'EX', 86400 * 365);
    this.logger.warn(`User banned: ${userId} reason=${reason}`);
  }

  async unbanUser(userId: string): Promise<void> {
    await this.userRepo.update(userId, { isBanned: false, banReason: null, updatedAt: new Date() });
    await this.redis.del(`auth:banned:${userId}`);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async generateTokens(user: UserEntity): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: `${ACCESS_TTL_MINUTES}m`,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: `${REFRESH_TTL_DAYS}d`,
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_MINUTES * 60 };
  }

  private validatePassword(password: string): void {
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) throw new BadRequestException('Password must contain an uppercase letter');
    if (!/[0-9]/.test(password)) throw new BadRequestException('Password must contain a number');
  }

  private async incrementFailedLogins(email: string, lockKey: string): Promise<void> {
    const failKey = `auth:fails:${email.toLowerCase()}`;
    const fails = await this.redis.incr(failKey);
    await this.redis.expire(failKey, LOCKOUT_MINUTES * 60);
    if (fails >= MAX_FAILED_LOGINS) {
      await this.redis.set(lockKey, '1', 'EX', LOCKOUT_MINUTES * 60);
      this.logger.warn(`Account locked after ${fails} failed attempts: ${email}`);
    }
  }

  private randomAvatar(): string {
    const colors = ['green', 'yellow', 'orange', 'red', 'blue', 'cyan', 'teal', 'pink', 'purple'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
