import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AntiCollusionGameProxy } from '../anti-collusion/anti-collusion.proxy';
import { GameEngineService } from './game-engine.service';
import { BotInternalGuard } from '../guards/bot-internal.guard';
import { IsNumber, IsOptional, IsString } from 'class-validator';

class BotActionDto {
  @IsString() playerId: string;
  @IsString() action: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsNumber() spaceIndex?: number;
}

@Controller('internal/bot')
@UseGuards(BotInternalGuard)
export class InternalBotController {
  constructor(
    private readonly proxy: AntiCollusionGameProxy,
    private readonly engine: GameEngineService,
  ) {}

  @Get('games/:gameId/state')
  getState(@Param('gameId') gameId: string) {
    return this.engine.getState(gameId);
  }

  @Post('games/:gameId/action')
  async performAction(@Param('gameId') gameId: string, @Body() dto: BotActionDto) {
    const { playerId, action, amount, spaceIndex } = dto;

    switch (action) {
      case 'roll':
        return this.proxy.rollDice(gameId, playerId);
      case 'buy':
        return this.proxy.buyProperty(gameId, playerId);
      case 'skip-buy':
        return this.proxy.skipBuy(gameId, playerId);
      case 'end-turn':
        return this.proxy.endTurn(gameId, playerId);
      case 'bid':
        if (amount == null) throw new BadRequestException('amount required for bid');
        return this.proxy.placeBid(gameId, playerId, amount);
      case 'finalize-auction':
        return this.proxy.finalizeAuction(gameId);
      case 'jail-pay':
        {
          let state = await this.engine.getState(gameId);
          const player = state.players.find(p => p.id === playerId);
          if (!player) throw new BadRequestException('Player not found');
          state = await this.engine.payJailFine(state, player);
          await this.engine.saveState(state);
          return state;
        }
      case 'jail-card':
        return this.proxy.useJailFreeCard(gameId, playerId);
      case 'build-house':
        if (spaceIndex == null) throw new BadRequestException('spaceIndex required');
        return this.proxy.buildHouse(gameId, playerId, spaceIndex);
      case 'mortgage':
        if (spaceIndex == null) throw new BadRequestException('spaceIndex required');
        return this.proxy.mortgageProperty(gameId, playerId, spaceIndex);
      default:
        throw new BadRequestException(`Unknown bot action: ${action}`);
    }
  }
}
