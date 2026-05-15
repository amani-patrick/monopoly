import {
  Controller, Get, Post, Body, Param, Req,
  UseGuards, HttpCode, HttpStatus, ValidationPipe, UsePipes,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GameEngineService } from './game-engine.service';
import { AntiCollusionGameProxy } from '../anti-collusion/anti-collusion.proxy';
import { IsArray, IsObject, IsString } from 'class-validator';

class InitGameDto {
  @IsString() roomId: string;
  @IsArray() players: any[];
  @IsObject() settings: any;
}

@Controller()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class GameController {
  constructor(
    private readonly engine: GameEngineService,
    private readonly proxy: AntiCollusionGameProxy,
  ) {}

  @Get('health')
  health() { return { status: 'ok', service: 'game-service', ts: new Date().toISOString() }; }

  /** Called internally by room-service when host starts a game */
  @Post('games/init')
  async initGame(@Body() dto: InitGameDto) {
    return this.engine.initGame(dto.roomId, dto.players, dto.settings);
  }

  /** Get live game state — authenticated players + spectators only */
  @Get('games/:gameId')
  @UseGuards(AuthGuard('jwt'))
  async getGame(@Param('gameId') gameId: string, @Req() req: any) {
    const state = await this.engine.getState(gameId);
    const isPlayer = state.players.some((p: any) => p.userId === req.user.sub);
    // Spectators can read state but player actions are blocked in WS gateway
    if (!isPlayer) {
      const spectatorKey = `room:${state.roomId}:spectators`;
      // Allow — WS gateway enforces spectator-only read
    }
    return state;
  }

  /** Admin: force-end a game */
  @Post('admin/games/:gameId/end')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async forceEnd(@Param('gameId') gameId: string, @Body() body: { reason: string }, @Req() req: any) {
    if (req.user.role !== 'admin') throw new BadRequestException('Forbidden');
    const state = await this.engine.getState(gameId).catch(() => null);
    if (state) await this.engine.saveState({ ...state, status: 'FINISHED' as any });
    return { success: true };
  }

  @Get('admin/games')
  @UseGuards(AuthGuard('jwt'))
  async adminGames(@Req() req: any) {
    if (req.user.role !== 'admin') throw new BadRequestException('Forbidden');
    const keys = await this.engine['redis'].keys('game:*:state');
    const games = await Promise.all(
      keys.slice(0, 50).map(async (k: any) => {
        const raw = await this.engine['redis'].get(k);
        if (!raw) return null;
        const s = JSON.parse(raw);
        return { id: s.id, roomId: s.roomId, status: s.status, players: s.players.length, round: s.round, startedAt: s.startedAt };
      })
    );
    return games.filter(Boolean);
  }

  @Get('admin/dashboard')
  @UseGuards(AuthGuard('jwt'))
  async dashboard(@Req() req: any) {
    if (req.user.role !== 'admin') throw new BadRequestException('Forbidden');
    const gameKeys = await this.engine['redis'].keys('game:*:state');
    const socketKeys = await this.engine['redis'].keys('socket:*');
    return {
      activeGames: gameKeys.length,
      activePlayers: socketKeys.length,
      ts: new Date().toISOString(),
    };
  }

  @Get('admin/revenue')
  @UseGuards(AuthGuard('jwt'))
  async revenue(@Req() req: any) {
    if (req.user.role !== 'admin') throw new BadRequestException('Forbidden');
    return { message: 'Revenue data lives in room-service DB — query via SQL or extend this endpoint.' };
  }

  @Post('admin/config')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async setConfig(@Body() body: { key: string; value: string }, @Req() req: any) {
    if (req.user.role !== 'admin') throw new BadRequestException('Forbidden');
    await this.engine['redis'].set(`config:${body.key}`, body.value);
    return { success: true };
  }
}

