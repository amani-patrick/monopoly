import {
  Controller, Get, Post, Body, Param, HttpCode, HttpStatus,
  BadRequestException, ValidationPipe, UsePipes,
} from '@nestjs/common';
import { AntiCollusionGameProxy } from '../anti-collusion/anti-collusion.proxy';
import { GameEngineService } from './game-engine.service';
import { ChatService } from '../chat/chat.service';
import { IsString, IsNumber, IsBoolean, IsOptional, IsArray, IsObject } from 'class-validator';

class InitDto {
  @IsString() roomId: string;
  @IsArray() players: any[];
  @IsObject() settings: any;
}

class PlayerActionDto {
  @IsString() playerId: string;
}

class SpaceActionDto extends PlayerActionDto {
  @IsNumber() spaceIndex: number;
}

class BidDto extends PlayerActionDto {
  @IsNumber() amount: number;
}

class TradeInitDto {
  @IsString() fromPlayerId: string;
  @IsString() toPlayerId: string;
  @IsObject() offer: any;
  @IsObject() request: any;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() userIp?: string;
}

class TradeRespondDto extends PlayerActionDto {
  @IsBoolean() accept: boolean;
}

class ChatDto {
  @IsString() userId: string;
  @IsString() displayName: string;
  @IsString() text: string;
  @IsOptional() @IsString() roomId?: string;
  @IsOptional() @IsString() gameId?: string;
}

@Controller()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class GameActionsController {
  constructor(
    private readonly proxy: AntiCollusionGameProxy,
    private readonly engine: GameEngineService,
    private readonly chat: ChatService,
  ) {}

  @Get('health')
  health() { return { status: 'ok', service: 'game-service', ts: new Date().toISOString() }; }

  @Post('games/init')
  async init(@Body() dto: InitDto) {
    return this.engine.initGame(dto.roomId, dto.players, dto.settings);
  }

  @Get('games/:gameId')
  async getState(@Param('gameId') gameId: string) {
    return this.engine.getState(gameId);
  }

  @Post('games/:gameId/roll')
  async roll(@Param('gameId') gameId: string, @Body() dto: PlayerActionDto) {
    return this.proxy.rollDice(gameId, dto.playerId);
  }

  @Post('games/:gameId/buy')
  async buy(@Param('gameId') gameId: string, @Body() dto: PlayerActionDto) {
    return this.proxy.buyProperty(gameId, dto.playerId);
  }

  @Post('games/:gameId/skip-buy')
  async skipBuy(@Param('gameId') gameId: string, @Body() dto: PlayerActionDto) {
    return this.proxy.skipBuy(gameId, dto.playerId);
  }

  @Post('games/:gameId/bid')
  async bid(@Param('gameId') gameId: string, @Body() dto: BidDto) {
    return this.proxy.placeBid(gameId, dto.playerId, dto.amount);
  }

  @Post('games/:gameId/build-house')
  async buildHouse(@Param('gameId') gameId: string, @Body() dto: SpaceActionDto) {
    return this.proxy.buildHouse(gameId, dto.playerId, dto.spaceIndex);
  }

  @Post('games/:gameId/build-hotel')
  async buildHotel(@Param('gameId') gameId: string, @Body() dto: SpaceActionDto) {
    return this.proxy.buildHotel(gameId, dto.playerId, dto.spaceIndex);
  }

  @Post('games/:gameId/sell-house')
  async sellHouse(@Param('gameId') gameId: string, @Body() dto: SpaceActionDto) {
    return this.proxy.sellHouse(gameId, dto.playerId, dto.spaceIndex);
  }

  @Post('games/:gameId/sell-hotel')
  async sellHotel(@Param('gameId') gameId: string, @Body() dto: SpaceActionDto) {
    return this.proxy.sellHotel(gameId, dto.playerId, dto.spaceIndex);
  }

  @Post('games/:gameId/mortgage')
  async mortgage(@Param('gameId') gameId: string, @Body() dto: SpaceActionDto) {
    return this.proxy.mortgageProperty(gameId, dto.playerId, dto.spaceIndex);
  }

  @Post('games/:gameId/unmortgage')
  async unmortgage(@Param('gameId') gameId: string, @Body() dto: SpaceActionDto) {
    return this.proxy.unmortgageProperty(gameId, dto.playerId, dto.spaceIndex);
  }

  @Post('games/:gameId/jail-pay')
  async jailPay(@Param('gameId') gameId: string, @Body() dto: PlayerActionDto) {
    let state = await this.engine.getState(gameId);
    const player = state.players.find(p => p.id === dto.playerId);
    if (!player) throw new BadRequestException('Player not found');
    state = await this.engine.payJailFine(state, player);
    await this.engine.saveState(state);
    return state;
  }

  @Post('games/:gameId/jail-card')
  async jailCard(@Param('gameId') gameId: string, @Body() dto: PlayerActionDto) {
    return this.proxy.useJailFreeCard(gameId, dto.playerId);
  }

  @Post('games/:gameId/end-turn')
  async endTurn(@Param('gameId') gameId: string, @Body() dto: PlayerActionDto) {
    return this.proxy.endTurn(gameId, dto.playerId);
  }

  @Post('games/:gameId/trade-initiate')
  async tradeInitiate(@Param('gameId') gameId: string, @Body() dto: TradeInitDto) {
    return this.proxy.initiateTrade(
      gameId, dto.fromPlayerId, dto.toPlayerId,
      dto.offer, dto.request, dto.message, dto.userIp,
    );
  }

  @Post('games/:gameId/trade-respond')
  async tradeRespond(@Param('gameId') gameId: string, @Body() dto: TradeRespondDto) {
    return this.proxy.respondTrade(gameId, dto.playerId, dto.accept);
  }

  @Post('chat/message')
  async chatMessage(@Body() dto: ChatDto) {
    return this.chat.sendMessage(dto);
  }
}
