import {
  Injectable, Logger, BadRequestException,
  ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Room, RoomPlayer, GameSettings } from '@umukino/shared-types';
import { REDIS_KEYS } from '@umukino/shared-events';
import { RoomEntity } from './entities/room.entity';

const PLATFORM_CUT = 0.10;

export interface CreateRoomDto {
  name: string; hostId: string; hostDisplayName: string; hostAvatar: string;
  settings: Partial<GameSettings>; entryFeeRwf: number;
  maxPlayers: number; isPrivate: boolean;
}

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    @InjectRepository(RoomEntity) private readonly roomRepo: Repository<RoomEntity>,
    @InjectRedis() private readonly redis: Redis,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  private get walletUrl() { return this.config.get('WALLET_SERVICE_URL', 'http://wallet-service:3004'); }
  private get gameUrl()   { return this.config.get('GAME_SERVICE_URL',   'http://game-service:3002'); }

  async createRoom(dto: CreateRoomDto): Promise<Room> {
    const code = this.generateCode();
    const roomId = uuid();

    const settings: GameSettings = {
      maxPlayers: Math.min(dto.maxPlayers, 8), privateRoom: dto.isPrivate,
      allowBots: false, onlyLoggedIn: false, doubleRentFullSet: false,
      vacationCash: false, auctionEnabled: false, noRentInJail: false,
      startingBalance: 150000, passStartBonus: 20000, entryFeeRwf: dto.entryFeeRwf,
      ...dto.settings,
    };

    const room: Room = {
      id: roomId, code, hostId: dto.hostId, name: dto.name, settings,
      players: [{ userId: dto.hostId, displayName: dto.hostDisplayName, avatar: dto.hostAvatar, ready: false, isBot: false }],
      status: 'LOBBY', gameId: null, createdAt: new Date().toISOString(),
    };

    await this.roomRepo.save({
      id: roomId, code, hostId: dto.hostId, name: dto.name, entryFeeRwf: dto.entryFeeRwf,
      maxPlayers: dto.maxPlayers, isPrivate: dto.isPrivate, status: 'LOBBY', prizePool: 0, settings,
    });

    await this.saveRoomState(room);

    // Mark host funds as held (not deducted yet)
    if (dto.entryFeeRwf > 0) await this.holdFunds(dto.hostId, dto.entryFeeRwf, roomId);

    return room;
  }

  async joinRoom(codeOrId: string, userId: string, displayName = 'Player', avatar = 'green', userIp?: string): Promise<Room> {
    const room = await this.getRoomByIdOrCode(codeOrId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== 'LOBBY') throw new BadRequestException('Game already in progress — use /spectate to watch');
    if (room.players.length >= room.settings.maxPlayers) throw new BadRequestException('Room is full');
    if (room.players.some((p: any) => p.userId === userId)) return room;

    const dbRoom = await this.roomRepo.findOneOrFail({ where: { id: room.id } });
    if (dbRoom.entryFeeRwf > 0) {
      await this.assertBalance(userId, dbRoom.entryFeeRwf);
      await this.holdFunds(userId, dbRoom.entryFeeRwf, room.id);
    }

    room.players.push({ userId, displayName, avatar, ready: false, isBot: false });
    await this.saveRoomState(room);
    return room;
  }

  async leaveRoom(codeOrId: string, userId: string): Promise<Room> {
    const room = await this.getRoomByIdOrCode(codeOrId);
    if (!room) throw new NotFoundException('Room not found');
    const dbRoom = await this.roomRepo.findOne({ where: { id: room.id } });

    if ((dbRoom?.entryFeeRwf || 0) > 0 && room.status === 'LOBBY') {
      await this.releaseHold(userId, room.id);
    }

    room.players = room.players.filter((p: any) => p.userId !== userId);
    if (room.hostId === userId && room.players.length > 0) room.hostId = room.players[0].userId;

    if (room.players.length === 0) {
      await this.roomRepo.update(room.id, { status: 'FINISHED' });
      await this.redis.del(REDIS_KEYS.roomState(room.id));
      return room;
    }
    await this.saveRoomState(room);
    return room;
  }

  async setReady(codeOrId: string, userId: string, ready: boolean): Promise<Room> {
    const room = await this.getRoomByIdOrCode(codeOrId);
    if (!room) throw new NotFoundException('Room not found');
    const p = room.players.find((p: any) => p.userId === userId);
    if (p) p.ready = ready;
    await this.saveRoomState(room);
    return room;
  }

  async startGame(codeOrId: string, hostId: string): Promise<{ gameId: string; room: Room }> {
    const room = await this.getRoomByIdOrCode(codeOrId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.hostId !== hostId) throw new ForbiddenException('Only the host can start');
    if (room.players.length < 2) throw new BadRequestException('Need at least 2 players');

    const dbRoom = await this.roomRepo.findOneOrFail({ where: { id: room.id } });
    const minP = (room.settings as any).minPlayers || 2;
    if (room.players.length < minP) throw new BadRequestException(`Need at least ${minP} players`);

    // Mandatory randomize on paid lobbies
    const players = (dbRoom.entryFeeRwf > 0 || (room.settings as any).randomizeOrder)
      ? [...room.players].sort(() => Math.random() - 0.5)
      : room.players;

    // Deduct held funds NOW that game starts
    if (dbRoom.entryFeeRwf > 0) {
      const pool = dbRoom.entryFeeRwf * players.length;
      for (const p of players) {
        await this.releaseFundHold(p.userId, dbRoom.entryFeeRwf, room.id, 'deduct');
      }
      await this.roomRepo.update(room.id, { prizePool: pool });
    }

    const { data: gameData } = await firstValueFrom(
      this.http.post(`${this.gameUrl}/games/init`, {
        roomId: room.id,
        players: players.map((p: any) => ({
          id: uuid(), userId: p.userId, displayName: p.displayName,
          avatar: p.avatar, color: p.avatar, isBot: p.isBot, connected: true,
        })),
        settings: { ...room.settings, entryFeeRwf: dbRoom.entryFeeRwf },
      }),
    );

    room.status = 'IN_GAME';
    room.gameId = gameData.id;
    await this.roomRepo.update(room.id, { status: 'IN_GAME', gameId: gameData.id });
    await this.saveRoomState(room);
    return { gameId: gameData.id, room };
  }

  // async addSpectator(codeOrId: string, userId: string): Promise<{ gameId: string }> {
  //   const room = await this.getRoomByIdOrCode(codeOrId);
  //   if (!room) throw new NotFoundException('Room not found');
  //   if (room.status !== 'IN_GAME') throw new BadRequestException('Game has not started yet');
  //   await this.redis.sadd(`room:${room.id}:spectators`, userId);
  //   await this.redis.expire(`room:${room.id}:spectators`, 86400);
  //   return { gameId: room.gameId! };
  // }
  // Service
  async addSpectator(codeOrId: string, userId: string | null): Promise<{ gameId: string }> {
    const room = await this.getRoomByIdOrCode(codeOrId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== 'IN_GAME') throw new BadRequestException('Game has not started yet');

    const spectatorId = userId ?? `guest:${uuid()}`;

    await this.redis.sadd(`room:${room.id}:spectators`, spectatorId);
    await this.redis.expire(`room:${room.id}:spectators`, 86400);
    return { gameId: room.gameId! };
  }

  async distributePrize(roomId: string, ranked: { userId: string; rank: number }[], mode = '1st_only'): Promise<void> {
    const dbRoom = await this.roomRepo.findOneOrFail({ where: { id: roomId } });
    if (dbRoom.prizeDistributed || dbRoom.prizePool === 0) return;

    const pool = Number(dbRoom.prizePool);
    const cut  = Math.floor(pool * PLATFORM_CUT);
    const prize = pool - cut;
    const payouts = this.calcPayouts(prize, ranked, mode);

    await this.dataSource.transaction(async (mgr) => {
      for (const { userId, amount } of payouts) {
        if (amount > 0) {
          await firstValueFrom(this.http.post(`${this.walletUrl}/wallet/internal/credit-prize`, { userId, amount, roomId }));
        }
      }
      await mgr.query('INSERT INTO platform_revenue (room_id, amount, created_at) VALUES ($1, $2, NOW())', [roomId, cut]);
      await mgr.update(RoomEntity, roomId, { status: 'FINISHED', prizeDistributed: true });
    });
    this.logger.log(`Prizes distributed room=${roomId} pool=${pool} cut=${cut}`);
  }

  private calcPayouts(prize: number, ranked: { userId: string; rank: number }[], mode: string) {
    const s = [...ranked].sort((a, b) => a.rank - b.rank);
    if (mode === '1st_only' || s.length < 2) return [{ userId: s[0]?.userId, amount: prize }];
    if (mode === '1st_2nd' && s.length >= 2) return [{ userId: s[0].userId, amount: Math.floor(prize * 0.67) }, { userId: s[1].userId, amount: Math.floor(prize * 0.33) }];
    if (mode === '1st_2nd_3rd' && s.length >= 3) return [{ userId: s[0].userId, amount: Math.floor(prize * 0.556) }, { userId: s[1].userId, amount: Math.floor(prize * 0.278) }, { userId: s[2].userId, amount: Math.floor(prize * 0.167) }];
    const total = s.reduce((acc, _, i) => acc + (s.length - i), 0);
    return s.map((p, i) => ({ userId: p.userId, amount: Math.floor(prize * (s.length - i) / total) }));
  }

  async getPublicRooms(page = 1, limit = 20, type?: string): Promise<any[]> {
    const qb = this.roomRepo.createQueryBuilder('r')
      .where("r.status = 'LOBBY'").andWhere('r.is_private = false')
      .orderBy('r.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    if (type === 'free') qb.andWhere('r.entry_fee_rwf = 0');
    if (type === 'paid') qb.andWhere('r.entry_fee_rwf > 0');
    const rooms = await qb.getMany();
    // Merge with Redis state for live player counts
    return Promise.all(rooms.map(async r => {
      const state = await this.getRoomState(r.id);
      return { ...r, players: state?.players || [], settings: state?.settings || r.settings };
    }));
  }

  async getRoomByCode(code: string): Promise<Room | null> { return this.getRoomByIdOrCode(code); }

  async closeRoom(roomId: string, adminId: string, reason: string): Promise<void> {
    await this.roomRepo.update(roomId, { status: 'FINISHED' });
    await this.redis.del(REDIS_KEYS.roomState(roomId));
  }

  // ---- Fund Hold Helpers ----
  private async holdFunds(userId: string, amount: number, roomId: string) {
    await this.redis.set(`hold:${roomId}:${userId}`, amount.toString(), 'EX', 86400);
  }
  private async releaseHold(userId: string, roomId: string) {
    await this.redis.del(`hold:${roomId}:${userId}`);
  }
  private async releaseFundHold(userId: string, amount: number, roomId: string, action: 'refund' | 'deduct') {
    await this.releaseHold(userId, roomId);
    if (action === 'deduct') {
      await firstValueFrom(this.http.post(`${this.walletUrl}/wallet/internal/deduct-entry`, { userId, amount, roomId })).catch(e => this.logger.error(`Deduct failed: ${e.message}`));
    }
  }
  private async assertBalance(userId: string, amount: number) {
    const { data } = await firstValueFrom(this.http.get(`${this.walletUrl}/wallet/${userId}/balance`)).catch(() => ({ data: { total: 0 } }));
    if ((data.total || 0) < amount) throw new ForbiddenException(`Need ${amount.toLocaleString()} RWF to join`);
  }

  // ---- Redis Helpers ----
  async getRoomState(roomId: string): Promise<Room | null> {
    const raw = await this.redis.get(REDIS_KEYS.roomState(roomId));
    return raw ? JSON.parse(raw) : null;
  }
  private async saveRoomState(room: Room) {
    await this.redis.set(REDIS_KEYS.roomState(room.id), JSON.stringify(room), 'EX', 86400);
    await this.redis.set(`room:code:${room.code}`, room.id, 'EX', 86400);
  }
  private async getRoomByIdOrCode(idOrCode: string): Promise<Room | null> {
    const idByCode = await this.redis.get(`room:code:${idOrCode}`);
    if (idByCode) { const r = await this.getRoomState(idByCode); if (r) return r; }
    return this.getRoomState(idOrCode);
  }
  private generateCode() { return Math.random().toString(36).substring(2, 7).toUpperCase(); }
}

