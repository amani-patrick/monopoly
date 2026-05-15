import {
  Controller, All, Req, Res, Param, UseGuards,
  Get, Post, Put, Delete, Body, Query,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Controller()
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);
  private readonly services: Record<string, string>;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.services = {
      auth: config.get('AUTH_SERVICE_URL', 'http://auth-service:3001'),
      game: config.get('GAME_SERVICE_URL', 'http://game-service:3002'),
      wallet: config.get('WALLET_SERVICE_URL', 'http://wallet-service:3004'),
      room: config.get('ROOM_SERVICE_URL', 'http://room-service:3005'),
      leaderboard: config.get('LEADERBOARD_SERVICE_URL', 'http://leaderboard-service:3006'),
    };
  }

  // ============================================================
  // HEALTH
  // ============================================================

  @Get('health')
  health() {
    return { status: 'ok', service: 'api-gateway', ts: new Date().toISOString() };
  }

  // ============================================================
  // AUTH ROUTES (public)
  // ============================================================

  @Post('auth/register')
  @UseGuards(RateLimitGuard)
  async register(@Body() body: any) {
    return this.proxy('auth', 'POST', '/auth/register', body);
  }

  @Post('auth/login')
  @UseGuards(RateLimitGuard)
  async login(@Body() body: any) {
    return this.proxy('auth', 'POST', '/auth/login', body);
  }

  @Post('auth/refresh')
  async refresh(@Body() body: any) {
    return this.proxy('auth', 'POST', '/auth/refresh', body);
  }

  @Post('auth/logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Body() body: any, @Req() req: any) {
    return this.proxy('auth', 'POST', '/auth/logout', body, req.user);
  }

  @Get('auth/google')
  async googleAuth() {
    return this.proxy('auth', 'GET', '/auth/google');
  }

  @Get('auth/google/callback')
  async googleCallback(@Query() query: any) {
    return this.proxy('auth', 'GET', `/auth/google/callback?${new URLSearchParams(query)}`);
  }

  // ============================================================
  // USER ROUTES (authenticated)
  // ============================================================

  @Get('users/me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return this.proxy('auth', 'GET', `/users/${req.user.sub}`, null, req.user);
  }

  @Put('users/me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Body() body: any, @Req() req: any) {
    return this.proxy('auth', 'PUT', `/users/${req.user.sub}`, body, req.user);
  }

  @Put('users/me/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Body() body: any, @Req() req: any) {
    return this.proxy('auth', 'PUT', `/users/${req.user.sub}/password`, body, req.user);
  }

  // ============================================================
  // ROOM ROUTES
  // ============================================================

  @Post('rooms')
  @UseGuards(JwtAuthGuard)
  async createRoom(@Body() body: any, @Req() req: any) {
    return this.proxy('room', 'POST', '/rooms', { ...body, hostId: req.user.sub }, req.user);
  }

  @Get('rooms')
  async getPublicRooms() {
    return this.proxy('room', 'GET', '/rooms/public');
  }

  @Get('rooms/:code')
  async getRoomByCode(@Param('code') code: string) {
    return this.proxy('room', 'GET', `/rooms/${code}`);
  }

  @Post('rooms/:code/join')
  @UseGuards(JwtAuthGuard)
  async joinRoom(@Param('code') code: string, @Req() req: any) {
    return this.proxy('room', 'POST', `/rooms/${code}/join`, { userId: req.user.sub }, req.user);
  }

  @Post('rooms/:code/leave')
  @UseGuards(JwtAuthGuard)
  async leaveRoom(@Param('code') code: string, @Req() req: any) {
    return this.proxy('room', 'POST', `/rooms/${code}/leave`, { userId: req.user.sub }, req.user);
  }

  // ============================================================
  // GAME ROUTES
  // ============================================================

  @Get('games/:gameId')
  @UseGuards(JwtAuthGuard)
  async getGame(@Param('gameId') gameId: string, @Req() req: any) {
    return this.proxy('game', 'GET', `/games/${gameId}`, null, req.user);
  }

  // ============================================================
  // WALLET ROUTES
  // ============================================================

  @Get('wallet/balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Req() req: any) {
    return this.proxy('wallet', 'GET', `/wallet/${req.user.sub}/balance`, null, req.user);
  }

  @Get('wallet/transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(@Query() query: any, @Req() req: any) {
    return this.proxy('wallet', 'GET', `/wallet/${req.user.sub}/transactions?${new URLSearchParams(query)}`, null, req.user);
  }

  @Post('wallet/deposit')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  async initiateDeposit(@Body() body: any, @Req() req: any) {
    return this.proxy('wallet', 'POST', '/wallet/deposit', { ...body, userId: req.user.sub }, req.user);
  }

  @Post('wallet/withdraw')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  async initiateWithdrawal(@Body() body: any, @Req() req: any) {
    return this.proxy('wallet', 'POST', '/wallet/withdraw', { ...body, userId: req.user.sub }, req.user);
  }

  @Post('wallet/webhook/:provider')
  async paymentWebhook(@Param('provider') provider: string, @Body() body: any) {
    return this.proxy('wallet', 'POST', `/wallet/webhook/${provider}`, body);
  }

  // ============================================================
  // LEADERBOARD ROUTES (public)
  // ============================================================

  @Get('leaderboard')
  async getLeaderboard(@Query() query: any) {
    return this.proxy('leaderboard', 'GET', `/leaderboard?${new URLSearchParams(query)}`);
  }

  @Get('leaderboard/players/:userId')
  async getPlayerStats(@Param('userId') userId: string) {
    return this.proxy('leaderboard', 'GET', `/leaderboard/players/${userId}`);
  }

  // ============================================================
  // ADMIN ROUTES (hidden, admin JWT required)
  // ============================================================

  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminDashboard(@Req() req: any) {
    return this.proxy('game', 'GET', '/admin/dashboard', null, req.user);
  }

  @Get('admin/users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminUsers(@Query() query: any, @Req() req: any) {
    return this.proxy('auth', 'GET', `/admin/users?${new URLSearchParams(query)}`, null, req.user);
  }

  @Post('admin/users/:userId/ban')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminBanUser(@Param('userId') userId: string, @Body() body: any, @Req() req: any) {
    return this.proxy('auth', 'POST', `/admin/users/${userId}/ban`, { ...body, adminId: req.user.sub }, req.user);
  }

  @Post('admin/users/:userId/unban')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminUnbanUser(@Param('userId') userId: string, @Req() req: any) {
    return this.proxy('auth', 'POST', `/admin/users/${userId}/unban`, { adminId: req.user.sub }, req.user);
  }

  @Get('admin/games')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminGames(@Req() req: any) {
    return this.proxy('game', 'GET', '/admin/games', null, req.user);
  }

  @Post('admin/games/:gameId/end')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminForceEndGame(@Param('gameId') gameId: string, @Body() body: any, @Req() req: any) {
    return this.proxy('game', 'POST', `/admin/games/${gameId}/end`, { ...body, adminId: req.user.sub }, req.user);
  }

  @Get('admin/revenue')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminRevenue(@Query() query: any, @Req() req: any) {
    return this.proxy('game', 'GET', `/admin/revenue?${new URLSearchParams(query)}`, null, req.user);
  }

  @Get('admin/transactions')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminTransactions(@Query() query: any, @Req() req: any) {
    return this.proxy('wallet', 'GET', `/admin/transactions?${new URLSearchParams(query)}`, null, req.user);
  }

  @Get('admin/rooms')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminRooms(@Query() query: any, @Req() req: any) {
    return this.proxy('room', 'GET', `/admin/rooms?${new URLSearchParams(query)}`, null, req.user);
  }

  @Post('admin/config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async adminSetConfig(@Body() body: any, @Req() req: any) {
    return this.proxy('game', 'POST', '/admin/config', body, req.user);
  }

  // ============================================================
  // PROXY HELPER
  // ============================================================

  private async proxy(
    service: string,
    method: string,
    path: string,
    body?: any,
    user?: any,
  ): Promise<any> {
    const url = `${this.services[service]}${path}`;
    try {
      const res = await firstValueFrom(
        this.http.request({
          method,
          url,
          data: body,
          headers: user ? { 'x-user': JSON.stringify(user) } : {},
          timeout: 15000,
        }),
      );
      return res.data;
    } catch (err: any) {
      const status = err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = err.response?.data?.message || err.message || 'Service error';
      this.logger.error(`Proxy error [${service}] ${method} ${path}: ${message}`);
      throw new HttpException(message, status);
    }
  }
}
