import { Injectable, Logger } from '@nestjs/common';
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

  async onPlayerBankrupt(state: GameState, player: Player, creditorId: string | null): Promise<void> {
    if (!this.anticheat.isPaidLobby(state)) return;
    // Note: simplified or extended depending on implementation
  }

  async onGameFinished(state: GameState): Promise<void> {
    this.anticheat.analyzePlayerPatterns(state.players[0]?.userId).catch(err => {
      this.logger.error('Post-game forensics failed:', err);
    });
  }

  async onPlayerJoinRoom(roomId: string, userId: string, userIp: string, isPaid: boolean): Promise<void> {
    if (!isPaid) return;
    await this.anticheat.checkCoJoinRisk(roomId, userId, userIp);
  }

  async getMatchmakingPool(userId: string): Promise<'shadow' | 'standard'> {
    const inShadow = await this.anticheat.analyzePlayerPatterns(userId);
    return inShadow.suspicious ? 'shadow' : 'standard';
  }

  // Pass-through & Missing methods
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
}
