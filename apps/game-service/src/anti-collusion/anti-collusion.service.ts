import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { Trade, TradeOffer, GameState, Player } from '@umukino/shared-types';
import { BOARD_SPACES } from '@umukino/board-data';
import { SuspicionRecord } from './schemas/suspicion-record.schema';
import * as crypto from 'crypto';

const TRADE_FAIRNESS_RATIO = 0.60;
const TRADE_FAIRNESS_FLEX_RATIO = 0.70; // More lenient threshold
const MAX_CASH_GIFT_PERCENT = 0.12;
const MAX_CASH_GIFT_RATE_PER_HOUR = 0.25; // Total cash gifts per hour
const REVIEW_QUEUE_SCORE = 40;
const SHADOW_POOL_SCORE = 65;
const IMMEDIATE_BAN_SCORE = 85;
const ASN_COOLDOWN_MS = 45000;
const PATTERN_WINDOW_GAMES = 20;
const PATTERN_WINDOW_DAYS = 7;
const INTENTIONAL_BANKRUPT_PEAK_RATIO = 0.35;
const MIN_PLAYERS_FOR_COLLUSION_ANALYSIS = 3;
const COLLUSION_RING_THRESHOLD = 0.75; // Co-occurrence rate
const DEVICE_FINGERPRINT_MATCH_THRESHOLD = 0.85;
const WIN_RATE_ANOMALY_THRESHOLD = 0.75; // Suspicious win rate
const COORDINATED_ACTION_WINDOW_MS = 5000; // Actions within 5s
const MAX_GAMES_PER_DAY_PAID = 30;

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
    (sum, idx) => sum + getPropertyMarketValue(idx, state),
    0,
  );
  return offer.cash + propValue + (offer.jailFreeCards || 0) * 5000;
}

// Advanced scoring functions
function calculateTradeAsymmetry(offerValue: number, requestValue: number): number {
  if (requestValue === 0) return offerValue > 0 ? 1 : 0;
  const ratio = offerValue / requestValue;
  return Math.abs(ratio - 1); // 0 = symmetric, higher = more asymmetric
}

function hashDeviceFingerprint(
  userAgent: string,
  acceptLanguage: string,
  timezone: string,
  screen: { width: number; height: number } | undefined,
): string {
  const combined = `${userAgent}|${acceptLanguage}|${timezone}|${screen?.width}x${screen?.height}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

function calculateCoOccurrenceScore(
  commonGames: number,
  totalGamesPlayer1: number,
  totalGamesPlayer2: number,
): number {
  if (totalGamesPlayer1 === 0 || totalGamesPlayer2 === 0) return 0;
  const coOccurrenceRate = (2 * commonGames) / (totalGamesPlayer1 + totalGamesPlayer2);
  return coOccurrenceRate; // 0-1, higher = more co-occurrence
}

function calculateWinRateAnomaly(playerWins: number, playerGames: number): number {
  if (playerGames < 10) return 0; // Not enough data
  return playerWins / playerGames;
}

@Injectable()
export class AntiCollusionService {
  private readonly logger = new Logger(AntiCollusionService.name);

  constructor(
    @InjectModel(SuspicionRecord.name) private readonly suspicionModel: Model<SuspicionRecord>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  isPaidLobby(state: GameState): boolean {
    return (state.settings?.entryFeeRwf ?? 0) > 0;
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
    const asymmetry = calculateTradeAsymmetry(offerValue, requestValue);

    // Direct cash transfer prohibition
    if (offer.properties.length === 0 && request.properties.length === 0) {
      throw new BadRequestException('Direct cash transfers are not allowed in paid lobbies.');
    }

    // Asymmetric trade check - with graduated scoring
    const fairnessRatio = requestValue > 0 ? offerValue / requestValue : 0;
    if (fairnessRatio > 0 && fairnessRatio < TRADE_FAIRNESS_RATIO) {
      const score = Math.round(40 * (1 - fairnessRatio / TRADE_FAIRNESS_RATIO));
      await this.recordSuspicion({
        userId: fromPlayer.userId,
        targetUserId: toPlayer.userId,
        contextId: state.id,
        type: 'asymmetric_trade_blocked',
        metadata: {
          offerValue,
          requestValue,
          ratio: fairnessRatio,
          asymmetry,
          gameId: state.id,
        },
        score: Math.min(score, 50),
      });
      throw new BadRequestException('Trade rejected: highly asymmetric offer.');
    }

    // Cash gift validation
    if (request.properties.length === 0 && request.cash === 0 && offer.cash > 0) {
      if (offer.cash / Math.max(fromPlayer.balance, 1) > MAX_CASH_GIFT_PERCENT) {
        throw new BadRequestException('Cash gift exceeds allowed percentage.');
      }

      // Check gift rate per time period
      const giftKey = `user:${fromPlayer.userId}:gifts:1h`;
      const hourlyGiftTotal = await this.redis.get(giftKey);
      if (hourlyGiftTotal) {
        const total = parseInt(hourlyGiftTotal, 10) + offer.cash;
        if (total / Math.max(fromPlayer.balance, 1) > MAX_CASH_GIFT_RATE_PER_HOUR) {
          await this.recordSuspicion({
            userId: fromPlayer.userId,
            targetUserId: toPlayer.userId,
            contextId: state.id,
            type: 'excessive_gifting',
            metadata: { totalGifts: total, balance: fromPlayer.balance },
            score: 25,
          });
          throw new BadRequestException('Cash gifts exceed hourly limit.');
        }
      }
    }

    // Collusion ring check
    await this.checkPairCollusionPattern(state, fromPlayer, toPlayer);
  }

  async onTradeCompleted(state: GameState, trade: Trade): Promise<void> {
    if (!this.isPaidLobby(state)) return;

    const from = state.players.find(p => p.id === trade.fromPlayerId);
    const to = state.players.find(p => p.id === trade.toPlayerId);
    if (!from || !to) return;

    const offerValue = getOfferTotalValue(trade.offer, state);
    const requestValue = getOfferTotalValue(trade.request, state);
    const ratio = requestValue > 0 ? offerValue / requestValue : 0;
    const asymmetry = calculateTradeAsymmetry(offerValue, requestValue);

    // Record trade for analysis
    const tradeKey = `game:${state.id}:trades`;
    await this.redis.lpush(tradeKey, JSON.stringify({
      fromUserId: from.userId,
      toUserId: to.userId,
      offerValue,
      requestValue,
      ratio,
      asymmetry,
      ts: Date.now(),
      properties: {
        fromProperties: trade.offer.properties,
        toProperties: trade.request.properties,
      },
    }));
    await this.redis.expire(tradeKey, 86400);

    // Asymmetric trade scoring
    if (ratio > 0 && ratio < TRADE_FAIRNESS_RATIO + 0.15) {
      const asymScore = Math.round(25 * asymmetry);
      await this.recordSuspicion({
        userId: from.userId,
        targetUserId: to.userId,
        contextId: state.id,
        type: 'asymmetric_trade_completed',
        metadata: { offerValue, requestValue, ratio, asymmetry },
        score: Math.min(asymScore, 40),
      });
    }

    // Pair trading pattern analysis
    const pairKey = `anticheat:pair:${[from.userId, to.userId].sort().join(':')}:trades`;
    const count = await this.redis.incr(pairKey);
    await this.redis.expire(pairKey, 86400 * 7);
    
    if (count >= 2) {
      // Analyze pattern of trades between this pair
      const pairPattern = await this.redis.lrange(pairKey, 0, -1);
      if (count >= 3 && pairPattern.length >= 3) {
        const score = Math.min(20 + count * 5, 50);
        await this.recordSuspicion({
          userId: from.userId,
          targetUserId: to.userId,
          contextId: state.id,
          type: 'frequent_pair_trading',
          metadata: { tradeCount: count, pattern: pairPattern.length },
          score,
        });
      }
    }

    // Track gift transfers
    if (trade.offer.properties.length === 0 && trade.request.properties.length === 0) {
      const giftKey = `user:${from.userId}:gifts:1h`;
      await this.redis.incrby(giftKey, trade.offer.cash);
      await this.redis.expire(giftKey, 3600);
    }
  }

  async onPlayerBankrupt(
    state: GameState,
    playerId: string,
    creditorId: string | null,
  ): Promise<void> {
    if (!this.isPaidLobby(state)) return;

    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const peakKey = `game:${state.id}:player:${player.userId}:peak_balance`;
    const peak = parseInt(await this.redis.get(peakKey) || '0', 10);
    const start = state.settings.startingBalance || 150000;

    if (peak > start * 1.2 && peak > 0 && player.balance <= 0) {
      const bankruptRatio = peak / Math.max(start, 1);
      if (bankruptRatio >= 1 / INTENTIONAL_BANKRUPT_PEAK_RATIO) {
        const creditor = creditorId
          ? state.players.find(p => p.id === creditorId)
          : null;
        await this.recordSuspicion({
          userId: player.userId,
          targetUserId: creditor?.userId,
          contextId: state.id,
          type: 'intentional_bankruptcy',
          metadata: { peak, start, creditorId: creditor?.userId ?? null },
          score: 45,
        });
      }
    }

    if (creditorId) {
      const creditor = state.players.find(p => p.id === creditorId);
      if (creditor) {
        const pairTrades = await this.redis.get(
          `anticheat:pair:${[player.userId, creditor.userId].sort().join(':')}:trades`,
        );
        if (pairTrades && parseInt(pairTrades, 10) >= 2) {
          await this.recordSuspicion({
            userId: player.userId,
            targetUserId: creditor.userId,
            contextId: state.id,
            type: 'bankrupt_after_trades',
            metadata: { priorTrades: pairTrades },
            score: 35,
          });
        }
      }
    }
  }

  async onGameFinished(state: GameState): Promise<void> {
    if (!this.isPaidLobby(state)) return;

    for (const player of state.players) {
      const analysis = await this.analyzePlayerPatterns(player.userId);
      if (analysis.suspicious) {
        await this.recordSuspicion({
          userId: player.userId,
          contextId: state.id,
          type: 'pattern_aggregate',
          metadata: { violations: analysis.violations, score: analysis.score },
          score: analysis.score,
        });
      }
    }
  }

  async trackPlayerBalance(gameId: string, userId: string, balance: number): Promise<void> {
    const key = `game:${gameId}:player:${userId}:peak_balance`;
    const current = parseInt(await this.redis.get(key) || '0', 10);
    if (balance > current) {
      await this.redis.set(key, balance.toString(), 'EX', 86400);
    }
  }

  async checkCoJoinRisk(roomId: string, userId: string, userIp: string, deviceFingerprint?: any): Promise<void> {
    const asn = await this.resolveASN(userIp);
    const roomAsnKey = `room:${roomId}:asns`;
    const existingAsns = await this.redis.smembers(roomAsnKey);

    // Check ASN co-joining
    if (existingAsns.includes(asn)) {
      const jitterKey = `room:${roomId}:asn:${asn}:jitter`;
      if (await this.redis.get(jitterKey)) {
        await this.recordSuspicion({
          userId,
          contextId: roomId,
          type: 'co_join_network',
          metadata: { asn, ip: userIp },
          score: 20,
        });
        throw new BadRequestException('Network co-join cooldown. Please wait before joining again.');
      }
    }

    // Track device fingerprint
    if (deviceFingerprint) {
      const { linked, linkedUsers } = await this.checkDeviceLinking(userId, deviceFingerprint);
      if (linked) {
        throw new BadRequestException('This device is associated with another account. Please use a different device or contact support.');
      }
      await this.trackDeviceFingerprint(userId, deviceFingerprint);
    }

    await this.redis.sadd(roomAsnKey, asn);
    await this.redis.expire(roomAsnKey, 86400);
    await this.redis.set(`room:${roomId}:asn:${asn}:jitter`, '1', 'PX', ASN_COOLDOWN_MS);
  }

  async isInShadowPool(userId: string): Promise<boolean> {
    const shadowStatus = await this.redis.get(`anticheat:shadowpool:${userId}`);
    if (!shadowStatus) return false;

    // Check if temporary shadow pool has expired
    const lockKey = `anticheat:shadowpool:lock:${userId}`;
    return !!(await this.redis.get(lockKey));
  }

  async checkPairCollusionPattern(
    state: GameState,
    player1: Player,
    player2: Player,
  ): Promise<void> {
    const pairKey = `anticheat:pair:${[player1.userId, player2.userId].sort().join(':')}:games`;
    const coOccurrenceCount = await this.redis.incr(pairKey);
    await this.redis.expire(pairKey, 86400 * 30);

    if (coOccurrenceCount >= 5) {
      const coOccurrenceScore = (coOccurrenceCount / 10) * 100; // Normalized to 100
      if (coOccurrenceScore > COLLUSION_RING_THRESHOLD * 100) {
        await this.recordSuspicion({
          userId: player1.userId,
          targetUserId: player2.userId,
          contextId: state.id,
          type: 'high_pair_co_occurrence',
          metadata: { coOccurrenceCount, score: coOccurrenceScore },
          score: Math.round(Math.min(coOccurrenceScore / 100 * 50, 45)),
        });
      }
    }
  }

  async detectCollusionRing(userIds: string[]): Promise<{
    detected: boolean;
    ring: string[];
    confidence: number;
  }> {
    if (userIds.length < MIN_PLAYERS_FOR_COLLUSION_ANALYSIS) {
      return { detected: false, ring: [], confidence: 0 };
    }

    const edgeMap: Record<string, Record<string, number>> = {};
    
    // Build co-occurrence graph
    for (const userId of userIds) {
      edgeMap[userId] = {};
      for (const otherUserId of userIds) {
        if (userId === otherUserId) continue;
        const pairKey = `anticheat:pair:${[userId, otherUserId].sort().join(':')}:games`;
        const count = parseInt(await this.redis.get(pairKey) || '0', 10);
        edgeMap[userId][otherUserId] = count;
      }
    }

    // Analyze connectivity
    let maxConnectivity = 0;
    let ring: string[] = [];
    for (const userId of userIds) {
      const connections = Object.values(edgeMap[userId] || {}).filter(c => c > 2).length;
      const connectivity = connections / (userIds.length - 1);
      if (connectivity > maxConnectivity) {
        maxConnectivity = connectivity;
        ring = [userId, ...Object.keys(edgeMap[userId] || {}).filter(u => edgeMap[userId][u] > 2)];
      }
    }

    return {
      detected: maxConnectivity >= COLLUSION_RING_THRESHOLD,
      ring,
      confidence: maxConnectivity,
    };
  }

  async trackDeviceFingerprint(
    userId: string,
    fingerprint: { userAgent?: string; acceptLanguage?: string; timezone?: string; screen?: { width: number; height: number } },
  ): Promise<void> {
    const hash = hashDeviceFingerprint(
      fingerprint.userAgent || 'unknown',
      fingerprint.acceptLanguage || 'unknown',
      fingerprint.timezone || 'UTC',
      fingerprint.screen,
    );
    const key = `user:${userId}:fingerprint`;
    await this.redis.sadd(key, hash);
    await this.redis.expire(key, 86400 * 90); // 90 days
  }

  async getDeviceFingerprints(userId: string): Promise<string[]> {
    const key = `user:${userId}:fingerprint`;
    return this.redis.smembers(key);
  }

  async checkDeviceLinking(
    userId: string,
    fingerprint: { userAgent?: string; acceptLanguage?: string; timezone?: string; screen?: { width: number; height: number } },
  ): Promise<{ linked: boolean; linkedUsers: string[] }> {
    const hash = hashDeviceFingerprint(
      fingerprint.userAgent || 'unknown',
      fingerprint.acceptLanguage || 'unknown',
      fingerprint.timezone || 'UTC',
      fingerprint.screen,
    );

    const linkedUsersKey = `fingerprint:${hash}:users`;
    const linkedUsers = await this.redis.smembers(linkedUsersKey);
    const filteredLinked = linkedUsers.filter(u => u !== userId);

    if (filteredLinked.length > 0) {
      for (const linkedUserId of filteredLinked) {
        await this.recordSuspicion({
          userId,
          targetUserId: linkedUserId,
          contextId: `device-link-${userId}`,
          type: 'device_fingerprint_match',
          metadata: { fingerprint: hash, linkedCount: filteredLinked.length },
          score: Math.min(30 + filteredLinked.length * 10, 50),
        });
      }
    }

    // Register this device for user
    await this.redis.sadd(linkedUsersKey, userId);
    await this.redis.expire(linkedUsersKey, 86400 * 90);

    return { linked: filteredLinked.length > 0, linkedUsers: filteredLinked };
  }

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

    let score = 0;
    const violations: string[] = [];
    const typeCounts: Record<string, number> = {};
    
    for (const rec of recentGames) {
      typeCounts[rec.type] = (typeCounts[rec.type] || 0) + 1;
    }

    // Weighted scoring based on violation types
    if ((typeCounts['asymmetric_trade_completed'] || 0) >= 3) {
      score += 35;
      violations.push('repeated_asymmetric_trades');
    }
    if ((typeCounts['intentional_bankruptcy'] || 0) >= 1) {
      score += 45;
      violations.push('intentional_bankruptcy');
    }
    if ((typeCounts['frequent_pair_trading'] || 0) >= 2) {
      score += 30;
      violations.push('frequent_pair_trading');
    }
    if ((typeCounts['bankrupt_after_trades'] || 0) >= 2) {
      score += 35;
      violations.push('bankrupt_after_trades');
    }
    if ((typeCounts['high_pair_co_occurrence'] || 0) >= 1) {
      score += 40;
      violations.push('collusion_ring_indicators');
    }
    if ((typeCounts['device_fingerprint_match'] || 0) >= 1) {
      score += 50;
      violations.push('multi_accounting');
    }
    if ((typeCounts['excessive_gifting'] || 0) >= 2) {
      score += 25;
      violations.push('excessive_cash_gifting');
    }

    return { suspicious: score >= REVIEW_QUEUE_SCORE, violations, score };
  }

  async recordSuspicion(params: {
    userId: string;
    targetUserId?: string;
    contextId: string;
    type: string;
    metadata?: Record<string, unknown>;
    score: number;
  }): Promise<void> {
    await this.suspicionModel.create({
      userId: params.userId,
      targetUserId: params.targetUserId,
      contextId: params.contextId,
      type: params.type,
      metadata: params.metadata ?? {},
      confirmed: false,
    });

    const queueId = params.targetUserId
      ? `${params.userId}:${params.targetUserId}`
      : params.userId;
    await this.redis.sadd('anticheat:review_queue', queueId);

    // Track score by user
    const userScoreKey = `anticheat:user_score:${params.userId}`;
    const currentScore = parseInt(await this.redis.get(userScoreKey) || '0', 10);
    const newScore = currentScore + params.score;
    await this.redis.set(userScoreKey, newScore.toString(), 'EX', 86400 * 7);

    // Immediate actions based on score
    if (newScore >= IMMEDIATE_BAN_SCORE) {
      await this.addToShadowPool(params.userId, `${params.type}:immediate_ban`);
      this.logger.error(
        `IMMEDIATE BAN TRIGGERED: ${params.type} user=${params.userId} totalScore=${newScore}`,
      );
    } else if (newScore >= SHADOW_POOL_SCORE) {
      await this.addToShadowPool(params.userId, params.type);
      if (params.targetUserId) {
        await this.addToShadowPool(params.targetUserId, `${params.type}:associated`);
      }
      this.logger.warn(
        `Added to shadow pool: ${params.type} user=${params.userId} score=${params.score} totalScore=${newScore}`,
      );
    } else {
      this.logger.log(
        `Suspicion recorded: ${params.type} user=${params.userId} score=${params.score} totalScore=${newScore}`,
      );
    }
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
    await this.addToShadowPool(userId, type);
  }

  async clearViolations(userId: string): Promise<void> {
    await this.suspicionModel.deleteMany({ $or: [{ userId }, { targetUserId: userId }] });
    await this.removeFromShadowPool(userId);
    const queue = await this.redis.smembers('anticheat:review_queue');
    for (const entry of queue) {
      if (entry === userId || entry.startsWith(`${userId}:`) || entry.endsWith(`:${userId}`)) {
        await this.redis.srem('anticheat:review_queue', entry);
      }
    }
  }

  private async resolveASN(ip: string): Promise<string> {
    if (!ip || ip === 'unknown') return 'AS-UNKNOWN';
    return `AS-MOCK-${ip.split('.').slice(0, 2).join('.')}`;
  }
}
