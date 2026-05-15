import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { TradeOffer, GameState, Player, SpaceType } from '@umukino/shared-types';
import { BOARD_SPACES, BOARD_CONFIG } from '@umukino/board-data';
import { SuspicionRecordDoc } from './schemas/suspicion-record.schema';
import { UserEntity } from '../auth/entities/user.entity';

// ============================================================
// THRESHOLDS — tune these as you gather real game data
// ============================================================
const TRADE_FAIRNESS_RATIO = 0.55;       // offer must be >= 55% of request value
const MAX_CASH_GIFT_PERCENT = 0.15;       // can't give >15% cash for nothing
const SUSPICIOUS_WIN_STREAK = 5;          // flag 5+ wins in ranked queue
const ASN_COOLDOWN_MS = 30_000;           // 30s jitter window for same-ASN joins
const SHADOW_POOL_THRESHOLD = 3;          // 3 confirmed violations → shadow pool
const PATTERN_WINDOW_GAMES = 10;          // look back 10 games for patterns
const INTENTIONAL_BANKRUPT_RATIO = 0.3;  // bankrupt at >30% avg balance = suspicious

// ============================================================
// PROPERTY VALUATIONS (market value for trade fairness)
// We use: mortgage × 2 = approximate market value
// Houses add 60% of house price each; hotels = 4×house + hotel price
// ============================================================
function getPropertyMarketValue(spaceIndex: number, state: GameState): number {
  const space = BOARD_SPACES[spaceIndex];
  if (!space?.price) return 0;

  const propState = state.properties.find(p => p.spaceIndex === spaceIndex);
  if (!propState) return space.price;

  let value = space.price;
  if (propState.mortgaged) return Math.floor(space.price * 0.5);
  if (propState.hotel) value += (space.housePrice || 0) * 4 + (space.hotelPrice || 0);
  else value += propState.houses * (space.housePrice || 0) * 0.6;

  return Math.floor(value);
}

function getOfferTotalValue(offer: TradeOffer, state: GameState): number {
  const propValue = offer.properties.reduce(
    (sum, idx) => sum + getPropertyMarketValue(idx, state), 0,
  );
  return offer.cash + propValue + offer.jailFreeCards * 5000; // 5k RWF per jail card
}

@Injectable()
export class AntiCollusionService {
  private readonly logger = new Logger(AntiCollusionService.name);

  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectModel('SuspicionRecord') private readonly suspicionModel: Model<SuspicionRecordDoc>,
    @InjectRedis() private readonly redis: Redis,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================
  // LOBBY MODE GATE
  // Friendly = no restrictions. Ranked/Paid = full engine active.
  // ============================================================

  isPaidLobby(state: GameState): boolean {
    // Paid lobby = entry fee was charged (stored in settings metadata)
    return (state.settings as any).entryFeeRwf > 0;
  }

  // ============================================================
  // 1. TRADE FAIRNESS ENGINE
  // ============================================================

  async validateTrade(
    state: GameState,
    fromPlayer: Player,
    toPlayer: Player,
    offer: TradeOffer,    // what fromPlayer gives
    request: TradeOffer,  // what fromPlayer wants
  ): Promise<void> {
    // Friendly lobby: classic P2P trades, no restrictions
    if (!this.isPaidLobby(state)) return;

    const offerValue  = getOfferTotalValue(offer, state);
    const requestValue = getOfferTotalValue(request, state);

    // Pure cash gift check — no direct cash transfer
    if (offer.properties.length === 0 && request.properties.length === 0) {
      throw new BadRequestException(
        'Direct cash transfers are not allowed in paid lobbies. Include properties in the trade.',
      );
    }

    // Lopsided trade check
    if (requestValue > 0 && offerValue / requestValue < TRADE_FAIRNESS_RATIO) {
      const ratio = (offerValue / requestValue * 100).toFixed(0);
      this.logger.warn(
        `Lopsided trade blocked: ${fromPlayer.userId} offering ${offerValue} RWF for ${requestValue} RWF (${ratio}%)`,
      );

      await this.recordSuspicion(fromPlayer.userId, toPlayer.userId, state.id, 'lopsided_trade', {
        offerValue, requestValue, ratio,
      });

      throw new BadRequestException(
        `Trade rejected: your offer (${offerValue.toLocaleString()} RWF) must be at least ` +
        `${Math.floor(requestValue * TRADE_FAIRNESS_RATIO).toLocaleString()} RWF ` +
        `(${Math.floor(TRADE_FAIRNESS_RATIO * 100)}% of what you're requesting).`,
      );
    }

    // Pure cash for nothing (gifting via fake trade)
    if (request.properties.length === 0 && request.cash === 0 && offer.cash > 0) {
      const balancePct = offer.cash / (fromPlayer.balance || 1);
      if (balancePct > MAX_CASH_GIFT_PERCENT) {
        throw new BadRequestException(
          `You cannot give away more than ${Math.floor(MAX_CASH_GIFT_PERCENT * 100)}% ` +
          `of your balance as cash without receiving properties in return.`,
        );
      }
    }

    this.logger.debug(`Trade validated: ${offerValue} for ${requestValue} — within fairness rules`);
  }

  // ============================================================
  // 2. INTENTIONAL BANKRUPTCY DETECTION
  // ============================================================

  async checkIntentionalBankruptcy(state: GameState, player: Player): Promise<void> {
    if (!this.isPaidLobby(state)) return;

    // If player goes bankrupt but had high balance recently, flag it
    const recentBalance = await this.redis.get(`game:${state.id}:player:${player.userId}:peak_balance`);
    if (!recentBalance) return;

    const peak = parseInt(recentBalance);
    const ratio = player.balance / peak;

    if (ratio > INTENTIONAL_BANKRUPT_RATIO && peak > BOARD_CONFIG.startingBalance * 0.5) {
      this.logger.warn(
        `Suspicious bankruptcy: ${player.userId} peak=${peak} final=${player.balance} ratio=${ratio.toFixed(2)}`,
      );

      await this.recordSuspicion(player.userId, null, state.id, 'intentional_bankruptcy', {
        peakBalance: peak, finalBalance: player.balance, ratio,
      });
    }
  }

  async trackPlayerBalance(gameId: string, userId: string, balance: number): Promise<void> {
    const key = `game:${gameId}:player:${userId}:peak_balance`;
    const current = parseInt(await this.redis.get(key) || '0');
    if (balance > current) {
      await this.redis.set(key, balance.toString(), 'EX', 86400);
    }
  }

  // ============================================================
  // 3. ASN / IP CO-JOIN DETECTION
  // ============================================================

  async checkCoJoinRisk(roomId: string, userId: string, userIp: string): Promise<void> {
    // Resolve ASN from IP (in production use MaxMind or ip-api.com)
    const asn = await this.resolveASN(userIp);
    const roomAsnKey = `room:${roomId}:asns`;

    // Get existing ASNs in room
    const existingAsns = await this.redis.smembers(roomAsnKey);

    if (existingAsns.includes(asn)) {
      // Same ASN — apply jitter window
      const jitterKey = `room:${roomId}:asn:${asn}:jitter`;
      const inJitter = await this.redis.get(jitterKey);

      if (inJitter) {
        this.logger.warn(`Same-ASN co-join blocked: user=${userId} ASN=${asn} room=${roomId}`);
        await this.recordSuspicion(userId, null, roomId, 'asn_co_join', { asn, userIp });
        throw new BadRequestException(
          'You cannot join this room immediately after someone on your network. Please wait 30 seconds.',
        );
      }
    }

    // Track this join with jitter window
    await this.redis.sadd(roomAsnKey, asn);
    await this.redis.expire(roomAsnKey, 3600);
    await this.redis.set(`room:${roomId}:asn:${asn}:jitter`, '1', 'PX', ASN_COOLDOWN_MS);
  }

  // ============================================================
  // 4. PATTERN DETECTION (post-game forensics)
  // ============================================================

  async analyzePlayerPatterns(userId: string): Promise<{
    suspicious: boolean;
    violations: string[];
    score: number;
  }> {
    const recentGames = await this.suspicionModel
      .find({ $or: [{ userId }, { targetUserId: userId }] })
      .sort({ createdAt: -1 })
      .limit(PATTERN_WINDOW_GAMES)
      .lean();

    const violations: string[] = [];
    let score = 0;

    // Count violation types
    const typeCounts: Record<string, number> = {};
    for (const rec of recentGames) {
      typeCounts[rec.type] = (typeCounts[rec.type] || 0) + 1;
    }

    if ((typeCounts['lopsided_trade'] || 0) >= 2) {
      violations.push('Repeated lopsided trades');
      score += 30;
    }
    if ((typeCounts['intentional_bankruptcy'] || 0) >= 1) {
      violations.push('Suspected intentional bankruptcy');
      score += 40;
    }
    if ((typeCounts['asn_co_join'] || 0) >= 2) {
      violations.push('Repeated same-network joins');
      score += 25;
    }

    // Check win-rate anomaly in ranked queue
    const winStreak = parseInt(await this.redis.get(`ranked:${userId}:winstreak`) || '0');
    if (winStreak >= SUSPICIOUS_WIN_STREAK) {
      violations.push(`Suspicious win streak: ${winStreak} consecutive ranked wins`);
      score += 20;
    }

    const suspicious = score >= 50;
    if (suspicious) {
      this.logger.warn(`Pattern detection flagged: ${userId} score=${score} violations=${violations.join(', ')}`);
    }

    return { suspicious, violations, score };
  }

  // ============================================================
  // 5. SHADOW POOL
  // Players with 3+ confirmed violations are silently matchmade
  // together — they cheat against other cheaters, not clean players
  // ============================================================

  async checkShadowPool(userId: string): Promise<boolean> {
    const key = `anticheat:shadowpool:${userId}`;
    const inPool = await this.redis.get(key);
    return !!inPool;
  }

  async addToShadowPool(userId: string, reason: string): Promise<void> {
    await this.redis.set(`anticheat:shadowpool:${userId}`, reason, 'EX', 86400 * 30); // 30 days
    await this.userRepo.update(userId, { isShadowBanned: true } as any);
    this.logger.warn(`User ${userId} added to shadow pool: ${reason}`);
  }

  async removeFromShadowPool(userId: string): Promise<void> {
    await this.redis.del(`anticheat:shadowpool:${userId}`);
    await this.userRepo.update(userId, { isShadowBanned: false } as any);
  }

  // ============================================================
  // 6. EARLY EXIT / DELIBERATE SACRIFICE DETECTION
  // ============================================================

  async checkEarlyExitPattern(
    state: GameState,
    bankruptPlayer: Player,
    creditorId: string,
  ): Promise<void> {
    if (!this.isPaidLobby(state)) return;

    // If same two users keep appearing as bankrupt + creditor across games, flag it
    const pairKey = `anticheat:pair:${[bankruptPlayer.userId, creditorId].sort().join(':')}`;
    const pairCount = await this.redis.incr(pairKey);
    await this.redis.expire(pairKey, 86400 * 7); // 7-day window

    if (pairCount >= 3) {
      this.logger.warn(
        `Suspicious pair pattern: ${bankruptPlayer.userId} → ${creditorId} bankrupt ${pairCount}× in 7 days`,
      );
      await this.recordSuspicion(
        bankruptPlayer.userId, creditorId, state.id, 'repeated_sacrifice', { pairCount },
      );

      // Auto-flag for admin review
      await this.redis.sadd('anticheat:review_queue', `${bankruptPlayer.userId}:${creditorId}`);
    }
  }

  // ============================================================
  // 7. CONSOLIDATED VIOLATION CHECK (run after each game in paid lobby)
  // ============================================================

  async runPostGameCheck(state: GameState): Promise<void> {
    if (!this.isPaidLobby(state)) return;

    for (const player of state.players) {
      const { suspicious, violations, score } = await this.analyzePlayerPatterns(player.userId);

      if (suspicious) {
        const confirmedViolations = await this.suspicionModel.countDocuments({
          userId: player.userId,
          confirmed: true,
        });

        if (confirmedViolations >= SHADOW_POOL_THRESHOLD) {
          await this.addToShadowPool(player.userId, violations.join('; '));
        } else {
          // Mark for admin review
          await this.redis.sadd('anticheat:review_queue', player.userId);
          this.logger.warn(
            `Post-game flag: ${player.userId} score=${score} — queued for review`,
          );
        }
      }
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async recordSuspicion(
    userId: string,
    targetUserId: string | null,
    contextId: string,
    type: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.suspicionModel.create({
      userId,
      targetUserId,
      contextId,
      type,
      metadata,
      confirmed: false,
      createdAt: new Date(),
    });
  }

  private async resolveASN(ip: string): Promise<string> {
    // In production: use MaxMind GeoIP2 or https://ip-api.com/json/${ip}?fields=as
    // For dev/mock: return a fake ASN based on IP prefix
    const prefix = ip.split('.').slice(0, 2).join('.');
    return `AS-MOCK-${prefix}`;
  }

  // Admin: get review queue
  async getReviewQueue(): Promise<string[]> {
    return this.redis.smembers('anticheat:review_queue');
  }

  async confirmViolation(userId: string, type: string): Promise<void> {
    await this.suspicionModel.updateMany({ userId, type }, { $set: { confirmed: true } });
    const confirmed = await this.suspicionModel.countDocuments({ userId, confirmed: true });
    if (confirmed >= SHADOW_POOL_THRESHOLD) {
      await this.addToShadowPool(userId, `${confirmed} confirmed violations`);
    }
  }

  async clearViolations(userId: string): Promise<void> {
    await this.suspicionModel.deleteMany({ userId });
    await this.removeFromShadowPool(userId);
    await this.redis.del(`anticheat:review_queue`);
  }
}
