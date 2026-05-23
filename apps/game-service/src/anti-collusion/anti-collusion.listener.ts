import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GAME_EVENTS, REDIS_CHANNELS } from '@umukino/shared-events';
import { GameState } from '@umukino/shared-types';
import { AntiCollusionService } from './anti-collusion.service';

@Injectable()
export class AntiCollusionListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AntiCollusionListener.name);
  private subscriber: Redis;

  constructor(
    private readonly anticheat: AntiCollusionService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.subscriber = new Redis(this.config.get('REDIS_URL', 'redis://127.0.0.1:6379'));
    await this.subscriber.subscribe(REDIS_CHANNELS.GAME_EVENTS);
    this.subscriber.on('message', (_channel, raw) => this.handleMessage(raw));
    this.logger.log('Anti-collusion event listener active');
  }

  async onModuleDestroy() {
    await this.subscriber?.quit();
  }

  private async handleMessage(raw: string) {
    try {
      const { event, data } = JSON.parse(raw) as { event: string; data: Record<string, unknown> };
      const gameId = data.gameId as string | undefined;
      if (!gameId) return;

      switch (event) {
        case GAME_EVENTS.TRADE_COMPLETED:
          await this.anticheat.onTradeCompleted(
            data.state as GameState,
            data.trade as Parameters<AntiCollusionService['onTradeCompleted']>[1],
          );
          break;
        case GAME_EVENTS.GAME_PLAYER_BANKRUPT:
          if (data.state) {
            await this.anticheat.onPlayerBankrupt(
              data.state as GameState,
              data.playerId as string,
              (data.creditorId as string | null) ?? null,
            );
          }
          break;
        case GAME_EVENTS.GAME_FINISHED:
          if (data.state) {
            await this.anticheat.onGameFinished(data.state as GameState);
          }
          break;
        default:
          break;
      }
    } catch (err: any) {
      this.logger.error(`Anti-collusion handler error: ${err.message}`);
    }
  }
}
