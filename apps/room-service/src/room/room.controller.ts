import {
  Controller, Get, Post, Body, Param, Query, Req,
  UseGuards, HttpCode, HttpStatus, ValidationPipe, UsePipes,
  BadRequestException,
} from '@nestjs/common';
import { XUserGuard } from '../guards/x-user.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { RoomService } from './room.service';
import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max, IsEnum } from 'class-validator';

class CreateRoomDto {
  @IsString() name: string;
  @IsNumber() @Min(0) entryFeeRwf: number;
  @IsNumber() @Min(2) @Max(8) maxPlayers: number;
  @IsBoolean() isPrivate: boolean;
  settings: any;
}

class JoinRoomDto {
  @IsOptional() @IsString() avatar?: string;
}

@Controller()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class RoomController {
  constructor(private readonly rooms: RoomService) {}

  @Get('health')
  health() { return { status: 'ok', service: 'room-service', ts: new Date().toISOString() }; }

  // ---- Public: list open rooms ----
  @Get('rooms/public')
  async getPublicRooms(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: 'free' | 'paid',
  ) {
    return this.rooms.getPublicRooms(parseInt(page), parseInt(limit), type);
  }

  // ---- Alias used by gateway ----
  @Get('rooms')
  async getRoomsAlias(@Query('page') page = '1') {
    return this.rooms.getPublicRooms(parseInt(page), 20);
  }

  // ---- Get room by code ----
  @Get('rooms/:code')
  async getRoom(@Param('code') code: string) {
    const room = await this.rooms.getRoomByCode(code);
    if (!room) throw new BadRequestException('Room not found');
    return room;
  }

  // ---- Create room ----
  @Post('rooms')
  @UseGuards(XUserGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createRoom(@Req() req: any, @Body() dto: CreateRoomDto) {
    return this.rooms.createRoom({
      ...dto,
      hostId: req.user.sub,
      hostDisplayName: req.user.displayName,
      hostAvatar: 'green',
      settings: dto.settings || {},
    });
  }

  // ---- Join room (funds put on hold, not deducted until game starts) ----
  @Post('rooms/:code/join')
  @UseGuards(XUserGuard, ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  async joinRoom(
    @Param('code') code: string,
    @Req() req: any,
    @Body() dto: JoinRoomDto,
  ) {
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.rooms.joinRoom(
      code,
      req.user.sub,
      req.user.displayName,
      dto.avatar,
      userIp,
    );
  }

  // ---- Leave room (funds refunded if game not started) ----
  @Post('rooms/:code/leave')
  @UseGuards(XUserGuard)
  @HttpCode(HttpStatus.OK)
  async leaveRoom(@Param('code') code: string, @Req() req: any) {
    return this.rooms.leaveRoom(code, req.user.sub);
  }

  // ---- Ready ----
  @Post('rooms/:code/ready')
  @UseGuards(XUserGuard)
  @HttpCode(HttpStatus.OK)
  async setReady(@Param('code') code: string, @Req() req: any) {
    return this.rooms.setReady(code, req.user.sub, true);
  }

  // ---- Host starts game ----
  @Post('rooms/:code/start')
  @UseGuards(XUserGuard)
  @HttpCode(HttpStatus.OK)
  async startGame(@Param('code') code: string, @Req() req: any) {
    return this.rooms.startGame(code, req.user.sub);
  }

  // ---- Spectator join (paid lobbies only, game must be IN_GAME) ----
  @Post('rooms/:code/spectate')
  // @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async spectate(@Param('code') code: string, @Req() req: any) {
    const userId = req.user ? req.user.sub : `guest_${Date.now()}`;
    return this.rooms.addSpectator(code, userId);
  }

  // ---- Admin ----
  @Get('admin/rooms')
  @UseGuards(XUserGuard)
  async adminRooms(@Query('status') status: string, @Req() req: any) {
    if (req.user.role !== 'admin') throw new BadRequestException('Forbidden');
    return this.rooms.getPublicRooms(1, 100);
  }

  @Post('admin/rooms/:roomId/close')
  @UseGuards(XUserGuard)
  @HttpCode(HttpStatus.OK)
  async adminCloseRoom(@Param('roomId') roomId: string, @Body() body: { reason: string }, @Req() req: any) {
    if (req.user.role !== 'admin') throw new BadRequestException('Forbidden');
    await this.rooms.closeRoom(roomId, req.user.sub, body.reason);
    return { success: true };
  }
}
