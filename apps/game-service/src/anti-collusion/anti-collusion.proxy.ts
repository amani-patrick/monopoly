import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GameEngineService } from '../game/game-engine.service';
import { AntiCollusionService } from './anti-collusion.service';
import { GameState, Player, TradeOffer } from '@umukino/shared-types';

@Injectable()
export class AntiCollusionGameProxy {
  private readonly logger = new Logger(AntiCollusionGameProxy.name);

  constructor(
    private readonly engine: GameEngineService,
    private readonly anticheat: AntiCollusionService,
  ) {}

  async initiateTrade(
    gameId: string,
    fromPlayerId: string,
    toPlayerId: string,
    offer: TradeOffer,
    request: TradeOffer,
    message?: string,
  ): Promise<GameState> {
    const state = await this.engine.getState(gameId);
    const fromPlayer = state.players.find((p: any) => p.id === fromPlayerId)!;
    const toPlayer   = state.players.find((p: any) => p.id === toPlayerId)!;

    await this.anticheat.validateTrade(state, fromPlayer, toPlayer, offer, request);
    return this.engine.initiateTrade(gameId, fromPlayerId, toPlayerId, offer, request, message);
  }

  async rollDice(gameId: string, playerId: string): Promise<GameState> {
    const state = await this.engine.rollDice(gameId, playerId);
    if (this.anticheat.isPaidLobby(state)) {
      for (const player of state.players) {
        await this.anticheat.trackPlayerBalance(gameId, player.userId, player.balance);
      }
    }
    return state;
  }

  async onPlayerJoinRoom(roomId: string, userId: string, userIp: string, isPaid: boolean): Promise<void> {
    if (!isPaid) return;
    const shadow = await this.anticheat.isInShadowPool(userId);
    if (shadow) {
      throw new BadRequestException('Account restricted from paid matchmaking.');
    }
    await this.anticheat.checkCoJoinRisk(roomId, userId, userIp);
  }

  async getMatchmakingPool(userId: string): Promise<'shadow' | 'standard'> {
    if (await this.anticheat.isInShadowPool(userId)) return 'shadow';
    const analysis = await this.anticheat.analyzePlayerPatterns(userId);
    return analysis.suspicious ? 'shadow' : 'standard';
  }

  // Pass-through methods
  getState(gameId: string) { return this.engine.getState(gameId); }
  buyProperty(g: string, p: string) { return this.engine.buyProperty(g, p); }
  skipBuy(g: string, p: string) { return this.engine.skipBuy(g, p); }
  placeBid(g: string, p: string, a: number) { return this.engine.placeBid(g, p, a); }
  finalizeAuction(g: string) { return this.engine.finalizeAuction(g); }
  buildHouse(g: string, p: string, s: number) { return this.engine.buildHouse(g, p, s); }
  buildHotel(g: string, p: string, s: number) { return this.engine.buildHotel(g, p, s); }
  sellHouse(g: string, p: string, s: number) { return this.engine.sellHouse(g, p, s); }
  sellHotel(g: string, p: string, s: number) { return this.engine.sellHotel(g, p, s); }
  mortgageProperty(g: string, p: string, s: number) { return this.engine.mortgageProperty(g, p, s); }
  unmortgageProperty(g: string, p: string, s: number) { return this.engine.unmortgageProperty(g, p, s); }
  useJailFreeCard(g: string, p: string) { return this.engine.useJailFreeCard(g, p); }
  respondTrade(g: string, p: string, a: boolean) { return this.engine.respondTrade(g, p, a); }
  endTurn(g: string, p: string) { return this.engine.endTurn(g, p); }
  payJailFine(s: any, p: any) { return this.engine.payJailFine(s, p); }
}
