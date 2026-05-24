import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { GAME_EVENTS, REDIS_CHANNELS } from '@umukino/shared-events';

// ---- Mongoose Schemas ----

export interface GameHistoryDoc {
  gameId: string;
  roomId: string;
  players: {
    userId: string;
    displayName: string;
    rank: number;
    finalBalance: number;
    propertiesOwned: number;
    housesBuilt: number;
    hotelsBuilt: number;
    rentCollected: number;
    rentPaid: number;
  }[];
  winnerId: string;
  duration: number; // seconds
  rounds: number;
  entryFee: number;
  prizePool: number;
  platformCut: number;
  finishedAt: Date;
  settings: Record<string, unknown>;
}

export interface PlayerStatsDoc {
  userId: string;
  displayName: string;
  avatar: string;
  gamesPlayed: number;
  gamesWon: number;
  totalEarned: number;      // RWF prize money won
  totalSpent: number;       // RWF entry fees paid
  totalRentCollected: number;
  totalRentPaid: number;
  highestBalance: number;
  longestWinStreak: number;
  currentWinStreak: number;
  lastPlayedAt: Date;
  updatedAt: Date;
}

export interface LeaderboardEntry extends PlayerStatsDoc {
  winRate: number;
  rank: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private readonly CACHE_TTL = 300;
  private readonly GLOBAL_LEADERBOARD_KEY = 'leaderboard:global';
  private readonly WINRATE_LEADERBOARD_KEY = 'leaderboard:winrate';

  constructor(
    @InjectModel('GameHistory') private readonly historyModel: Model<GameHistoryDoc>,
    @InjectModel('PlayerStats') private readonly statsModel: Model<PlayerStatsDoc>,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.subscribeToGameEvents();
  }

  // ============================================================
  // GAME EVENT LISTENER
  // ============================================================

  private subscribeToGameEvents() {
    const sub = this.redis.duplicate();
    sub.subscribe(REDIS_CHANNELS.GAME_EVENTS);

    sub.on('message', async (_, message) => {
      try {
        const { event, data } = JSON.parse(message);
        if (event === GAME_EVENTS.GAME_FINISHED) {
          await this.recordGameResult(data);
        }
      } catch (err) {
        this.logger.error('Leaderboard event error:', err);
      }
    });
  }

  // ============================================================
  // RECORD GAME RESULT
  // ============================================================

  async recordGameResult(data: { gameId: string; state: any; }): Promise<void> {
    const { state } = data;

    const startedAt = new Date(state.startedAt);
    const finishedAt = new Date(state.finishedAt);
    const duration = Math.max(0, Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000));
    const entryFee = state.settings?.entryFee ?? 0;
    const prizePool = state.prizePool ?? state.settings?.prizePool ?? 0;
    const platformCut = state.platformCut ?? state.settings?.platformCut ?? 0;

    const players = state.players.map((p: any) => ({
      userId: p.userId,
      displayName: p.displayName,
      rank: p.rank || 99,
      finalBalance: p.balance ?? 0,
      propertiesOwned: Array.isArray(p.properties) ? p.properties.length : 0,
      housesBuilt: p.housesBuilt ?? 0,
      hotelsBuilt: p.hotelsBuilt ?? 0,
      rentCollected: p.rentCollected ?? 0,
      rentPaid: p.rentPaid ?? 0,
    }));

    // Save game history
    await this.historyModel.create({
      gameId: state.id,
      roomId: state.roomId,
      players,
      winnerId: state.winner,
      duration,
      rounds: state.round,
      entryFee,
      prizePool,
      platformCut,
      finishedAt,
      settings: state.settings,
    });

    // Update player stats
    await Promise.all(state.players.map((p: any) => this.updatePlayerStats(p, state.winner)));

    // Refresh leaderboard caches
    await this.refreshLeaderboardCache();

    this.logger.log(`Game history recorded: ${state.id}`);
  }

  private async updatePlayerStats(player: any, winnerId: string): Promise<void> {
    const isWinner = player.userId === winnerId;
    const existing = await this.statsModel.findOne({ userId: player.userId });
    const currentBalance = player.balance ?? 0;
    const nextStreak = isWinner ? (existing?.currentWinStreak ?? 0) + 1 : 0;

    const update = {
      $inc: {
        gamesPlayed: 1,
        gamesWon: isWinner ? 1 : 0,
      },
      $set: {
        currentWinStreak: nextStreak,
        longestWinStreak: Math.max(existing?.longestWinStreak ?? 0, nextStreak),
        lastPlayedAt: new Date(),
        updatedAt: new Date(),
        displayName: player.displayName,
        avatar: player.avatar ?? existing?.avatar ?? 'blue',
        highestBalance: Math.max(existing?.highestBalance ?? 0, currentBalance),
      },
    };

    if (existing) {
      await this.statsModel.updateOne({ userId: player.userId }, update);
    } else {
      await this.statsModel.create({
        userId: player.userId,
        displayName: player.displayName,
        avatar: player.avatar ?? 'blue',
        gamesPlayed: 1,
        gamesWon: isWinner ? 1 : 0,
        totalEarned: 0,
        totalSpent: 0,
        totalRentCollected: 0,
        totalRentPaid: 0,
        highestBalance: currentBalance,
        longestWinStreak: isWinner ? 1 : 0,
        currentWinStreak: isWinner ? 1 : 0,
        lastPlayedAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // ============================================================
  // LEADERBOARD QUERIES
  // ============================================================

  async getGlobalLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const cached = await this.redis.get(this.GLOBAL_LEADERBOARD_KEY);
    if (cached) return JSON.parse(cached);

    const data = await this.statsModel
      .find()
      .sort({ gamesWon: -1, totalEarned: -1, lastPlayedAt: -1 })
      .limit(limit)
      .lean();

    const normalized = data.map((item: any, index: number) => ({
      ...item,
      rank: index + 1,
      winRate: item.gamesPlayed ? item.gamesWon / item.gamesPlayed : 0,
    })) as LeaderboardEntry[];

    await this.redis.set(this.GLOBAL_LEADERBOARD_KEY, JSON.stringify(normalized), 'EX', this.CACHE_TTL);
    return normalized;
  }

  async getWinRateLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const cached = await this.redis.get(this.WINRATE_LEADERBOARD_KEY);
    if (cached) return JSON.parse(cached);

    const data = await this.statsModel.aggregate([
      { $match: { gamesPlayed: { $gte: 5 } } },
      {
        $addFields: {
          winRate: { $divide: ['$gamesWon', '$gamesPlayed'] },
        },
      },
      { $sort: { winRate: -1, gamesPlayed: -1, totalEarned: -1 } },
      { $limit: limit },
    ]);

    const normalized = data.map((item: any, index: number) => ({
      ...item,
      rank: index + 1,
    })) as LeaderboardEntry[];

    await this.redis.set(this.WINRATE_LEADERBOARD_KEY, JSON.stringify(normalized), 'EX', this.CACHE_TTL);
    return normalized;
  }

  async getPlayerStats(userId: string): Promise<PlayerStatsDoc | null> {
    return this.statsModel.findOne({ userId }).lean() as any;
  }

  async getPlayerHistory(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
    const [data, total] = await Promise.all([
      this.historyModel
        .find({ 'players.userId': userId })
        .sort({ finishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.historyModel.countDocuments({ 'players.userId': userId }),
    ]);
    return { data, total };
  }

  async getRecentGames(limit = 20): Promise<any[]> {
    return this.historyModel.find().sort({ finishedAt: -1 }).limit(limit).lean();
  }

  private async refreshLeaderboardCache(): Promise<void> {
    await Promise.all([
      this.redis.del(this.GLOBAL_LEADERBOARD_KEY),
      this.redis.del(this.WINRATE_LEADERBOARD_KEY),
    ]);
  }
}
