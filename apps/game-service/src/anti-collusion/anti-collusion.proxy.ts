import { Injectable, Logger } from '@nestjs/common';
import { GameEngineService } from '../game/game-engine.service';
import { AntiCollusionService } from './anti-collusion.service';
import { GameState, Player, TradeOffer } from '@umukino/shared-types';

/**
 * AntiCollusionGameProxy
 *
 * Wraps the GameEngineService with anti-collusion checks.
 * The game engine itself stays pure (just game logic).
 * This proxy layer intercepts actions in paid lobbies.
 */
@Injectable()
export class AntiCollusionGameProxy {
  private readonly logger = new Logger(AntiCollusionGameProxy.name);

  constructor(
    private readonly engine: GameEngineService,
    private readonly anticheat: AntiCollusionService,
  ) {}

  // ============================================================
  // TRADE — validated before execution
  // ============================================================

  async initiateTrade(
    gameId: string,
    fromPlayerId: string,
    toPlayerId: string,
    offer: TradeOffer,
    request: TradeOffer,
    message?: string,
    userIp?: string,
  ): Promise<GameState> {
    const state = await this.engine.getState(gameId);
    const fromPlayer = state.players.find(p => p.id === fromPlayerId)!;
    const toPlayer   = state.players.find(p => p.id === toPlayerId)!;

    // Anti-collusion: validate trade fairness in paid lobbies
    await this.anticheat.validateTrade(state, fromPlayer, toPlayer, offer, request);

    return this.engine.initiateTrade(gameId, fromPlayerId, toPlayerId, offer, request, message);
  }

  // ============================================================
  // ROLL — track balance snapshots for bankruptcy detection
  // ============================================================

  async rollDice(gameId: string, playerId: string): Promise<GameState> {
    const state = await this.engine.rollDice(gameId, playerId);

    // Snapshot balances for anti-collusion
    if (this.anticheat.isPaidLobby(state)) {
      for (const player of state.players) {
        await this.anticheat.trackPlayerBalance(gameId, player.userId, player.balance);
      }
    }

    return state;
  }

  // ============================================================
  // BANKRUPTCY — check intentional sacrifice & pair patterns
  // ============================================================

  async onPlayerBankrupt(state: GameState, player: Player, creditorId: string | null): Promise<void> {
    if (!this.anticheat.isPaidLobby(state)) return;

    await this.anticheat.checkIntentionalBankruptcy(state, player);

    if (creditorId) {
      await this.anticheat.checkEarlyExitPattern(state, player, creditorId);
    }
  }

  // ============================================================
  // GAME FINISHED — run full post-game forensics
  // ============================================================

  async onGameFinished(state: GameState): Promise<void> {
    // Run asynchronously — don't block prize distribution
    this.anticheat.runPostGameCheck(state).catch(err => {
      this.logger.error('Post-game anti-collusion check failed:', err);
    });
  }

  // ============================================================
  // ROOM JOIN — ASN/IP co-join check
  // ============================================================

  async onPlayerJoinRoom(roomId: string, userId: string, userIp: string, isPaid: boolean): Promise<void> {
    if (!isPaid) return;
    await this.anticheat.checkCoJoinRisk(roomId, userId, userIp);
  }

  // ============================================================
  // MATCHMAKING — shadow pool routing
  // ============================================================

  async getMatchmakingPool(userId: string): Promise<'shadow' | 'standard'> {
    const inShadow = await this.anticheat.checkShadowPool(userId);
    if (inShadow) {
      this.logger.debug(`User ${userId} routed to shadow pool`);
      return 'shadow';
    }
    return 'standard';
  }

  // ============================================================
  // PASS-THROUGH — delegate all other methods to engine
  // ============================================================

  getState(gameId: string)       { return this.engine.getState(gameId); }
  saveState(state: GameState)    { return this.engine.saveState(state); }
  buyProperty(g: string, p: string)    { return this.engine.buyProperty(g, p); }
  skipBuy(g: string, p: string)        { return this.engine.skipBuy(g, p); }
  placeBid(g: string, p: string, a: number) { return this.engine.placeBid(g, p, a); }
  finalizeAuction(g: string)           { return this.engine.finalizeAuction(g); }
  buildHouse(g: string, p: string, s: number) { return this.engine.buildHouse(g, p, s); }
  buildHotel(g: string, p: string, s: number) { return this.engine.buildHotel(g, p, s); }
  mortgageProperty(g: string, p: string, s: number) { return this.engine.mortgageProperty(g, p, s); }
  unmortgageProperty(g: string, p: string, s: number) { return this.engine.unmortgageProperty(g, p, s); }
  payJailFine(s: GameState, p: Player) { return this.engine.payJailFine(s, p); }
  useJailFreeCard(g: string, p: string) { return this.engine.useJailFreeCard(g, p); }
  respondTrade(g: string, p: string, a: boolean) { return this.engine.respondTrade(g, p, a); }
  endTurn(g: string, p: string)        { return this.engine.endTurn(g, p); }
}
