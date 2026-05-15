import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { GameRecord } from '../game/entities/game.entity';
import { AntiCollusionService } from '../anti-collusion/anti-collusion.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(GameRecord) private readonly gameRepo: Repository<GameRecord>,
    @InjectRedis() private readonly redis: Redis,
    private readonly antiCollusion: AntiCollusionService,
    private readonly dataSource: DataSource,
  ) {}

  async getDashboard(): Promise<any> {
    const totalGames = await this.gameRepo.count();
    const activeGameKeys = await this.redis.keys('game:*:state');
    const activeGames = activeGameKeys.length;
    const activePlayers = await this.redis.keys('socket:*');

    return {
      games: { total: totalGames, active: activeGames },
      activeNow: { games: activeGames, players: activePlayers.length },
      system: { status: 'ok', ts: new Date().toISOString() }
    };
  }

  async getReviewQueue(): Promise<string[]> {
    return this.antiCollusion.getReviewQueue();
  }

  async confirmViolation(userId: string, type: string): Promise<void> {
    return this.antiCollusion.confirmViolation(userId, type);
  }

  async clearViolations(userId: string): Promise<void> {
    return this.antiCollusion.clearViolations(userId);
  }

  async getActiveGames(): Promise<any[]> {
    const keys = await this.redis.keys('game:*:state');
    const games = await Promise.all(
      keys.slice(0, 50).map(async (key) => {
        const raw = await this.redis.get(key);
        if (!raw) return null;
        const state = JSON.parse(raw);
        return {
          id: state.id,
          roomId: state.roomId,
          status: state.status,
          playerCount: state.players.length,
          round: state.round,
        };
      }),
    );
    return games.filter(Boolean);
  }

  async forceEndGame(gameId: string, adminId: string, reason: string): Promise<void> {
    this.logger.warn(`Admin ${adminId} force-ended game ${gameId}: ${reason}`);
    await this.redis.del(`game:${gameId}:state`);
    await this.redis.publish('umukino:game-events', JSON.stringify({
      event: 'game.error',
      gameId,
      data: { message: `Game ended by administrator: ${reason}` },
    }));
  }
}
