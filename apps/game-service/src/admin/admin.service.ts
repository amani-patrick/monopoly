import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { UserEntity } from '../auth/entities/user.entity';
import { RoomEntity } from '../room/entities/room.entity';
import { TransactionEntity } from '../wallet/entities/transaction.entity';
import { UserBan } from '../chat/entities/user-ban.entity';
import { ChatService } from '../chat/chat.service';
import { AuthService } from '../auth/auth.service';

/**
 * Admin Service — NOT exposed via public API routes
 * Only accessible via /admin/* routes with admin JWT role check
 * Never visible in frontend client bundles
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoomEntity) private readonly roomRepo: Repository<RoomEntity>,
    @InjectRepository(TransactionEntity) private readonly txRepo: Repository<TransactionEntity>,
    @InjectRedis() private readonly redis: Redis,
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================
  // DASHBOARD STATS
  // ============================================================

  async getDashboard(): Promise<{
    users: UserStats;
    revenue: RevenueStats;
    games: GameStats;
    activeNow: ActiveStats;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, newToday, newThisMonth] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { createdAt: Between(today, now) } }),
      this.userRepo.count({ where: { createdAt: Between(thisMonth, now) } }),
    ]);

    const [totalRooms, roomsToday, totalGames] = await Promise.all([
      this.roomRepo.count(),
      this.roomRepo.count({ where: { createdAt: Between(today, now) } }),
      this.roomRepo.count({ where: { status: 'FINISHED' } }),
    ]);

    // Revenue from platform cuts
    const revenueResult = await this.dataSource.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total,
        COALESCE(SUM(CASE WHEN created_at >= $1 THEN amount END), 0) as today,
        COALESCE(SUM(CASE WHEN created_at >= $2 THEN amount END), 0) as this_month
      FROM platform_revenue
    `, [today, thisMonth]);

    // Active games/users in Redis
    const activeGameKeys = await this.redis.keys('game:*:state');
    const activeGames = activeGameKeys.length;
    const activeSockets = await this.redis.keys('socket:*');

    return {
      users: { total: totalUsers, newToday, newThisMonth },
      revenue: {
        total: Number(revenueResult[0]?.total || 0),
        today: Number(revenueResult[0]?.today || 0),
        thisMonth: Number(revenueResult[0]?.this_month || 0),
        currency: 'RWF',
      },
      games: { total: totalGames, roomsCreated: totalRooms, roomsToday },
      activeNow: { games: activeGames, players: activeSockets.length },
    };
  }

  // ============================================================
  // USER MANAGEMENT
  // ============================================================

  async getUsers(page = 1, limit = 50, search?: string): Promise<{ data: any[]; total: number }> {
    const qb = this.userRepo.createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.displayName', 'u.role', 'u.isBanned', 'u.createdAt', 'u.lastLoginAt'])
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.where('u.email ILIKE :s OR u.displayName ILIKE :s', { s: `%${search}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async banUser(adminId: string, userId: string, reason: string): Promise<void> {
    if (userId === adminId) throw new ForbiddenException('Cannot ban yourself');
    await this.authService.banUser(userId, reason);
    await this.chatService.manualBan(userId, 24 * 365, reason); // Chat ban too
    this.logger.warn(`Admin ${adminId} banned user ${userId}: ${reason}`);
  }

  async unbanUser(adminId: string, userId: string): Promise<void> {
    await this.authService.unbanUser(userId);
    await this.chatService.unban(userId);
    this.logger.log(`Admin ${adminId} unbanned user ${userId}`);
  }

  async promoteToAdmin(userId: string): Promise<void> {
    await this.userRepo.update(userId, { role: 'admin', updatedAt: new Date() });
  }

  // ============================================================
  // GAME MONITORING
  // ============================================================

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
          startedAt: state.startedAt,
        };
      }),
    );
    return games.filter(Boolean);
  }

  async getGameDetails(gameId: string): Promise<any> {
    const raw = await this.redis.get(`game:${gameId}:state`);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async forceEndGame(gameId: string, adminId: string, reason: string): Promise<void> {
    this.logger.warn(`Admin ${adminId} force-ended game ${gameId}: ${reason}`);
    await this.redis.del(`game:${gameId}:state`);
    // Emit to WS gateway via Redis pub/sub
    await this.redis.publish('umukino:game-events', JSON.stringify({
      event: 'game.error',
      gameId,
      data: { message: `Game ended by administrator: ${reason}` },
    }));
  }

  // ============================================================
  // REVENUE & TRANSACTIONS
  // ============================================================

  async getRevenueHistory(days = 30): Promise<any[]> {
    return this.dataSource.query(`
      SELECT DATE(created_at) as date, SUM(amount) as revenue
      FROM platform_revenue
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
  }

  async getTransactions(page = 1, limit = 50, userId?: string): Promise<any> {
    const qb = this.txRepo.createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (userId) qb.where('t.userId = :userId', { userId });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  // ============================================================
  // ROOM MANAGEMENT
  // ============================================================

  async getRooms(page = 1, limit = 50, status?: string): Promise<any> {
    const where: any = {};
    if (status) where.status = status;
    const [data, total] = await this.roomRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async closeRoom(roomId: string, adminId: string, reason: string): Promise<void> {
    await this.roomRepo.update(roomId, { status: 'FINISHED' });
    await this.redis.del(`room:${roomId}:state`);
    this.logger.warn(`Admin ${adminId} closed room ${roomId}: ${reason}`);
  }

  // ============================================================
  // PLATFORM CONFIG (runtime toggles)
  // ============================================================

  async setPlatformConfig(key: string, value: string): Promise<void> {
    await this.redis.set(`config:${key}`, value);
    this.logger.log(`Platform config updated: ${key}=${value}`);
  }

  async getPlatformConfig(): Promise<Record<string, string>> {
    const keys = await this.redis.keys('config:*');
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key.replace('config:', '')] = await this.redis.get(key) || '';
    }
    return result;
  }
}

// Type helpers
interface UserStats { total: number; newToday: number; newThisMonth: number; }
interface RevenueStats { total: number; today: number; thisMonth: number; currency: string; }
interface GameStats { total: number; roomsCreated: number; roomsToday: number; }
interface ActiveStats { games: number; players: number; }
