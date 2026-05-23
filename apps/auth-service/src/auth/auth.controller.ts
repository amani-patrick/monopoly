import {
  Controller, Post, Get, Put, Body, Param, Req,
  UseGuards, HttpCode, HttpStatus, ValidationPipe,
  UsePipes, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { XUserGuard } from './guards/x-user.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { FirebaseAuthService } from './firebase-auth.service';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

// ---- DTOs ----
class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) @Matches(/[A-Z]/, { message: 'Need uppercase' }) @Matches(/[0-9]/, { message: 'Need number' }) password: string;
  @IsString() @MinLength(2) @MaxLength(30) displayName: string;
}
class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
class RefreshDto { @IsString() refreshToken: string; }
class FirebaseAuthDto { @IsString() idToken: string; }
class ChangePasswordDto {
  @IsString() oldPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}
class UpdateProfileDto {
  @IsString() @MaxLength(30) displayName?: string;
  @IsString() avatar?: string;
}

@Controller()
@UseGuards(ThrottlerGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly firebase: FirebaseAuthService,
  ) {}

  // ---- Health ----
  @Get('health')
  health() { return { status: 'ok', service: 'auth-service', ts: new Date().toISOString() }; }

  // ---- Register ----
  @Post('auth/register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.displayName);
  }

  // ---- Login ----
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  // ---- Refresh ----
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refreshTokens(dto.refreshToken);
  }

  // ---- Logout ----
  @Post('auth/logout')
  @UseGuards(XUserGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { success: true };
  }

  // ---- Firebase Google (client-side) ----
  @Post('auth/firebase')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async firebaseAuth(@Body() dto: FirebaseAuthDto) {
    const profile = await this.firebase.verifyIdToken(dto.idToken);
    return this.auth.handleFirebaseAuth({
      googleId: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
      picture: profile.picture,
    });
  }

  // ---- Google OAuth (Passport redirect — legacy) ----
  @Get('auth/google')
  @UseGuards(AuthGuard('google'))
  googleAuth() { /* Passport redirects */ }

  @Get('auth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any) {
    return this.auth.handleGoogleAuth(req.user);
  }

  // ---- Profile ----
  @Get('users/me')
  @UseGuards(XUserGuard)
  async getMe(@Req() req: any) {
    return this.auth.getProfile(req.user.sub);
  }

  @Put('users/me')
  @UseGuards(XUserGuard)
  async updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    await this.auth.updateProfile(req.user.sub, dto);
    return this.auth.getProfile(req.user.sub);
  }

  @Put('users/me/password')
  @UseGuards(XUserGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(req.user.sub, dto.oldPassword, dto.newPassword);
    return { success: true };
  }

  // ---- Internal ----
  @Get('users/:id')
  @UseGuards(XUserGuard)
  async getUser(@Param('id') id: string, @Req() req: any) {
    if (req.user.sub !== id && req.user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }
    return this.auth.getProfile(id);
  }

  // ---- Admin ----
  @Get('admin/users')
  @UseGuards(XUserGuard)
  async adminUsers(@Req() req: any) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admin access required');
    return this.auth.getUsers(1, 50);
  }

  @Post('admin/users/:userId/ban')
  @UseGuards(XUserGuard)
  @HttpCode(HttpStatus.OK)
  async adminBan(@Param('userId') userId: string, @Body() body: { reason: string }, @Req() req: any) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admin access required');
    await this.auth.banUser(userId, body.reason);
    return { success: true };
  }

  @Post('admin/users/:userId/unban')
  @UseGuards(XUserGuard)
  @HttpCode(HttpStatus.OK)
  async adminUnban(@Param('userId') userId: string, @Req() req: any) {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admin access required');
    await this.auth.unbanUser(userId);
    return { success: true };
  }
}
