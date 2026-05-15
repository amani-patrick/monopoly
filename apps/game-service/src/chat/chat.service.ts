import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { ChatMessage } from './entities/chat-message.entity';
import { UserBan } from './entities/user-ban.entity';

const BANNED_WORDS = [
  // Common profanity list (extend as needed)
  'fuck', 'shit', 'ass', 'bitch', 'bastard', 'damn', 'crap',
  'hell', 'piss', 'cock', 'dick', 'pussy', 'whore', 'slut',
  // Kinyarwanda slurs (placeholders — replace with actual moderation list)
  'impfu', 'injangwe',
];

const MAX_STRIKES = 3;
const BAN_DURATIONS_HOURS = [1, 24, 168]; // 1h, 24h, 1 week

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(UserBan) private readonly banRepo: Repository<UserBan>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async sendMessage({ userId, displayName, text, roomId, gameId }: {
    userId: string;
    displayName: string;
    text: string;
    roomId?: string;
    gameId?: string;
  }): Promise<{ message: any; banned: boolean; banReason?: string; banUntil?: Date }> {

    // Check if user is currently banned
    const activeBan = await this.getActiveBan(userId);
    if (activeBan) {
      return { message: null, banned: true, banReason: 'You are banned', banUntil: activeBan.until };
    }

    // Sanitize and check message
    const trimmed = text.trim().slice(0, 500); // 500 char limit
    const { clean, violations } = this.moderateText(trimmed);

    let banned = false;
    let banReason: string | undefined;
    let banUntil: Date | undefined;

    if (violations.length > 0) {
      const strikeResult = await this.addStrike(userId, violations.join(', '));
      this.logger.warn(`User ${userId} strike ${strikeResult.strikes}/${MAX_STRIKES}: ${violations.join(', ')}`);

      if (strikeResult.strikes >= MAX_STRIKES) {
        const banResult = await this.banUser(userId, strikeResult.banCount);
        banned = true;
        banReason = `Banned for language violations (${banResult.durationHours}h)`;
        banUntil = banResult.until;
      }
    }

    // Save message (even if violated, save the cleaned version for audit)
    const msg = await this.msgRepo.save({
      userId,
      displayName,
      text: clean,
      rawText: trimmed,
      roomId,
      gameId,
      hadViolation: violations.length > 0,
      createdAt: new Date(),
    });

    return {
      message: {
        id: msg.id,
        userId,
        displayName,
        text: clean,
        roomId,
        gameId,
        ts: msg.createdAt.toISOString(),
      },
      banned,
      banReason,
      banUntil,
    };
  }

  private moderateText(text: string): { clean: string; violations: string[] } {
    const violations: string[] = [];
    let clean = text;

    for (const word of BANNED_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(text)) {
        violations.push(word);
        clean = clean.replace(regex, '***');
      }
    }

    return { clean, violations };
  }

  private async addStrike(userId: string, reason: string): Promise<{ strikes: number; banCount: number }> {
    const key = `chat:strikes:${userId}`;
    const banCountKey = `chat:bancount:${userId}`;

    const strikes = await this.redis.incr(key);
    if (strikes === 1) {
      await this.redis.expire(key, 60 * 60 * 24 * 7); // 7 day window
    }

    let banCount = 0;
    if (strikes >= MAX_STRIKES) {
      banCount = parseInt(await this.redis.get(banCountKey) || '0') + 1;
      await this.redis.set(banCountKey, banCount);
      await this.redis.del(key); // Reset strikes after ban
    }

    return { strikes, banCount };
  }

  private async banUser(userId: string, banCount: number): Promise<{ durationHours: number; until: Date }> {
    const idx = Math.min(banCount - 1, BAN_DURATIONS_HOURS.length - 1);
    const durationHours = BAN_DURATIONS_HOURS[idx];
    const until = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    await this.banRepo.save({ userId, until, reason: 'Language violations', createdAt: new Date() });
    await this.redis.set(`chat:ban:${userId}`, until.toISOString(), 'EX', durationHours * 3600);

    this.logger.warn(`User ${userId} banned for ${durationHours}h`);
    return { durationHours, until };
  }

  private async getActiveBan(userId: string): Promise<{ until: Date } | null> {
    const raw = await this.redis.get(`chat:ban:${userId}`);
    if (!raw) return null;
    const until = new Date(raw);
    if (until > new Date()) return { until };
    return null;
  }

  async getHistory(roomId?: string, gameId?: string, limit = 50): Promise<ChatMessage[]> {
    const where: any = {};
    if (roomId) where.roomId = roomId;
    if (gameId) where.gameId = gameId;
    return this.msgRepo.find({ where, order: { createdAt: 'DESC' }, take: limit });
  }

  // Admin methods
  async manualBan(userId: string, hours: number, reason: string): Promise<void> {
    const until = new Date(Date.now() + hours * 3600 * 1000);
    await this.banRepo.save({ userId, until, reason, createdAt: new Date() });
    await this.redis.set(`chat:ban:${userId}`, until.toISOString(), 'EX', hours * 3600);
  }

  async unban(userId: string): Promise<void> {
    await this.redis.del(`chat:ban:${userId}`);
    await this.banRepo.update({ userId }, { until: new Date() });
  }
}
