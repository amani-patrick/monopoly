import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { GameState, Player, TurnPhase } from '@umukino/shared-types';
import { GAME_EVENTS, REDIS_CHANNELS } from '@umukino/shared-events';
import { LOCAL_SERVICE_URLS } from '@umukino/shared-types';
import { BotBrain } from './bot-brain';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private subscriber: Redis;
  private readonly gameServiceUrl: string;
  private readonly botKey: string;
  private readonly brain = new BotBrain('hard');
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.gameServiceUrl = this.config.get('GAME_SERVICE_URL', LOCAL_SERVICE_URLS.game);
    this.botKey = this.config.get('BOT_INTERNAL_KEY', 'bot-secret');
  }

  async onModuleInit() {
    this.subscriber = new Redis(this.config.get('REDIS_URL', 'redis://127.0.0.1:6379'));
    await this.subscriber.subscribe(REDIS_CHANNELS.GAME_EVENTS);
    this.subscriber.on('message', (_ch, raw) => this.onRedisMessage(raw));
    this.logger.log(`Bot engine listening → ${this.gameServiceUrl}`);
  }

  async onModuleDestroy() {
    for (const t of this.pending.values()) clearTimeout(t);
    await this.subscriber?.quit();
  }

  private onRedisMessage(raw: string) {
    try {
      const { event, data } = JSON.parse(raw) as { event: string; data: Record<string, unknown> };
      const state = data.state as GameState | undefined;
      if (!state?.id) return;

      const triggers = [
        GAME_EVENTS.GAME_STARTED,
        GAME_EVENTS.GAME_STATE_SYNC,
        GAME_EVENTS.TURN_STARTED,
        GAME_EVENTS.TURN_ENDED,
        GAME_EVENTS.TURN_DICE_ROLLED,
        GAME_EVENTS.PROPERTY_PURCHASED,
        GAME_EVENTS.PROPERTY_SKIPPED,
        GAME_EVENTS.AUCTION_STARTED,
        GAME_EVENTS.AUCTION_BID_PLACED,
        GAME_EVENTS.AUCTION_SOLD,
        GAME_EVENTS.AUCTION_NO_BIDS,
        GAME_EVENTS.TRADE_COMPLETED,
        GAME_EVENTS.JAIL_SENT,
        GAME_EVENTS.CARD_EFFECT_APPLIED,
      ];

      if (!triggers.includes(event as typeof triggers[number])) return;

      const bot = state.players[state.currentPlayerIndex];
      if (!bot?.isBot) return;

      this.scheduleTurn(state.id, bot, state);
    } catch (err: any) {
      this.logger.error(`Event parse error: ${err.message}`);
    }
  }

  private scheduleTurn(gameId: string, bot: Player, snapshot: GameState) {
    const key = gameId;
    if (this.pending.has(key)) clearTimeout(this.pending.get(key)!);

    const delay = 800 + Math.floor(Math.random() * 700);
    const timer = setTimeout(() => this.runTurn(gameId, bot.id, snapshot.turnPhase), delay);
    this.pending.set(key, timer);
  }

  private async runTurn(gameId: string, playerId: string, lastPhase?: TurnPhase) {
    this.pending.delete(gameId);
    try {
      let state = await this.fetchState(gameId);
      let bot = state.players.find(p => p.id === playerId);
      if (!bot?.isBot) return;
      if (state.players[state.currentPlayerIndex]?.id !== playerId) return;

      let safety = 0;
      while (safety < 12) {
        safety++;
        bot = state.players.find(p => p.id === playerId)!;
        const decision = this.brain.decide(state, bot);
        if (!decision) break;

        if (state.turnPhase === lastPhase && decision.action === 'end-turn' && safety === 1) {
          break;
        }
        lastPhase = state.turnPhase;

        state = await this.performAction(gameId, playerId, decision.action, {
          amount: decision.amount,
          spaceIndex: decision.spaceIndex,
        });

        if (state.turnPhase === TurnPhase.END && decision.action !== 'end-turn') {
          continue;
        }
        if (state.turnPhase === TurnPhase.ROLL && decision.action === 'end-turn') {
          break;
        }
        if (decision.action === 'finalize-auction') break;
        if (state.status === 'FINISHED') break;
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      this.logger.warn(`Bot turn failed [${gameId}]: ${msg}`);
    }
  }

  private async fetchState(gameId: string): Promise<GameState> {
    const { data } = await firstValueFrom(
      this.http.get(`${this.gameServiceUrl}/internal/bot/games/${gameId}/state`, {
        headers: { 'x-bot-key': this.botKey },
      }),
    );
    return data;
  }

  private async performAction(
    gameId: string,
    playerId: string,
    action: string,
    extra: { amount?: number; spaceIndex?: number } = {},
  ): Promise<GameState> {
    const { data } = await firstValueFrom(
      this.http.post(
        `${this.gameServiceUrl}/internal/bot/games/${gameId}/action`,
        { playerId, action, ...extra },
        { headers: { 'x-bot-key': this.botKey }, timeout: 15000 },
      ),
    );
    return data;
  }
}
