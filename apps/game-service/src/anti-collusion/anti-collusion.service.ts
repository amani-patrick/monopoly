import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { TradeOffer, GameState, Player, SpaceType } from '@umukino/shared-types';
import { BOARD_SPACES, BOARD_CONFIG } from '@umukino/board-data';
import { SuspicionRecord } from './schemas/suspicion-record.schema';

const TRADE_FAIRNESS_RATIO = 0.55;
const MAX_CASH_GIFT_PERCENT = 0.15;
const SUSPICIOUS_WIN_STREAK = 5;
const ASN_COOLDOWN_MS = 30000;
const SHADOW_POOL_THRESHOLD = 3;
const PATTERN_WINDOW_GAMES = 10;
const INTENTIONAL_BANKRUPT_RATIO = 0.3;

function getPropertyMarketValue(spaceIndex: number, state: GameState): number {
  const space = BOARD_SPACES[spaceIndex];
  if (!space?.price) return 0;

  const propState = state.properties.find((p: any) => p.spaceIndex === spaceIndex);
  if (!propState) return space.price;

  let value = space.price;
  if (propState.mortgaged) return Math.floor(space.price * 0.5);
  if (propState.hotel) value += (space.housePrice || 0) * 4 + (space.hotelPrice || 0);
  else value += propState.houses * (space.housePrice || 0) * 0.6;

  return Math.floor(value);
}

function getOfferTotalValue(offer: TradeOffer, state: GameState): number {
  const propValue = offer.properties.reduce(
    (sum: number, idx: number) => sum + getPropertyMarketValue(idx, state), 0,
  );
  return offer.cash + propValue + (offer.jailFreeCards || 0) * 5000;
}

@Injectable()
export class AntiCollusionService {
  private readonly logger = new Logger(AntiCollusionService.name);

  constructor(
    @InjectModel(SuspicionRecord.name) private readonly suspicionModel: Model<SuspicionRecord>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  isPaidLobby(state: GameState): boolean {
    return (state.settings as any)?.entryFeeRwf > 0;
  }

  async validateTrade(
    state: GameState,
    fromPlayer: Player,
    toPlayer: Player,
    offer: TradeOffer,
    request: TradeOffer,
  ): Promise<void> {
    if (!this.isPaidLobby(state)) return;

    const offerValue = getOfferTotalValue(offer, state);
    const requestValue = getOfferTotalValue(request, state);

    if (offer.properties.length === 0 && request.properties.length === 0) {
      throw new BadRequestException('Direct cash transfers are not allowed in paid lobbies.');
    }

    if (requestValue > 0 && offerValue / requestValue < TRADE_FAIRNESS_RATIO) {
      throw new BadRequestException('Trade rejected: lopsided offer.');
    }

    if (request.properties.length === 0 && request.cash === 0 && offer.cash > 0) {
      if (offer.cash / (fromPlayer.balance || 1) > MAX_CASH_GIFT_PERCENT) {
        throw new BadRequestException('Cash gift too high.');
      }
    }
  }

  async trackPlayerBalance(gameId: string, userId: string, balance: number): Promise<void> {
    const key = `game:${gameId}:player:${userId}:peak_balance`;
    const current = parseInt(await this.redis.get(key) || '0');
    if (balance > current) {
      await this.redis.set(key, balance.toString(), 'EX', 86400);
    }
  }

  async checkCoJoinRisk(roomId: string, userId: string, userIp: string): Promise<void> {
    const asn = await this.resolveASN(userIp);
    const roomAsnKey = `room:${roomId}:asns`;
    const existingAsns = await this.redis.smembers(roomAsnKey);

    if (existingAsns.includes(asn)) {
      const jitterKey = `room:${roomId}:asn:${asn}:jitter`;
      if (await this.redis.get(jitterKey)) {
        throw new BadRequestException('Network co-join cooldown.');
      }
    }

    await this.redis.sadd(roomAsnKey, asn);
    await this.redis.set(`room:${roomId}:asn:${asn}:jitter`, '1', 'PX', ASN_COOLDOWN_MS);
  }

  async analyzePlayerPatterns(userId: string): Promise<any> {
    const recentGames = await this.suspicionModel
      .find({ $or: [{ userId }, { targetUserId: userId }] })
      .sort({ createdAt: -1 })
      .limit(PATTERN_WINDOW_GAMES)
      .lean();

    let score = 0;
    const violations: string[] = [];
    const typeCounts: Record<string, number> = {};
    for (const rec of recentGames) {
      typeCounts[rec.type] = (typeCounts[rec.type] || 0) + 1;
    }

    if ((typeCounts['lopsided_trade'] || 0) >= 2) score += 30;
    if ((typeCounts['intentional_bankruptcy'] || 0) >= 1) score += 40;

    return { suspicious: score >= 50, violations, score };
  }

  async addToShadowPool(userId: string, reason: string): Promise<void> {
    await this.redis.set(`anticheat:shadowpool:${userId}`, reason, 'EX', 86400 * 30);
  }

  async removeFromShadowPool(userId: string): Promise<void> {
    await this.redis.del(`anticheat:shadowpool:${userId}`);
  }

  async getReviewQueue(): Promise<string[]> {
    return this.redis.smembers('anticheat:review_queue');
  }

  async confirmViolation(userId: string, type: string): Promise<void> {
    await this.suspicionModel.updateMany({ userId, type }, { $set: { confirmed: true } });
  }

  async clearViolations(userId: string): Promise<void> {
    await this.suspicionModel.deleteMany({ userId });
    await this.removeFromShadowPool(userId);
    await this.redis.srem('anticheat:review_queue', userId);
  }

  private async resolveASN(ip: string): Promise<string> {
    return `AS-MOCK-${ip.split('.').slice(0, 2).join('.')}`;
  }
}
