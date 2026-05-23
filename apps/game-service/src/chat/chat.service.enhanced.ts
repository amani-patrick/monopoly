import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { ChatMessage } from './entities/chat-message.entity';
import { UserBan } from './entities/user-ban.entity';
import { EventEmitter } from 'events';

// Enhanced banned words with severity levels
const BANNED_WORDS = [
  // High severity
  { word: 'fuck', severity: 'high' },
  { word: 'shit', severity: 'high' },
  { word: 'bitch', severity: 'high' },
  { word: 'asshole', severity: 'high' },
  // Medium severity
  { word: 'damn', severity: 'medium' },
  { word: 'hell', severity: 'medium' },
  { word: 'crap', severity: 'medium' },
  // Kinyarwanda slurs (extend with actual moderation list)
  { word: 'impfu', severity: 'high' },
  { word: 'injangwe', severity: 'high' },
];

// Configuration constants
const MAX_STRIKES = 3;
const BAN_DURATIONS_HOURS = [1, 24, 168];
const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_RATE_LIMIT = 5; // messages per 10 seconds
const TYPING_INDICATOR_TIMEOUT = 3000;
const USER_PRESENCE_TTL = 1800; // 30 minutes
const PRESENCE_CHECK_INTERVAL = 300000; // 5 minutes
const SPAM_THRESHOLD = 10;
const MAX_HISTORY_LIMIT = 100;
const REACTION_LIMIT = 30;

// Enums for chat features
export enum ChatEventType {
  MESSAGE_SENT = 'message:sent',
  MESSAGE_EDITED = 'message:edited',
  MESSAGE_DELETED = 'message:deleted',
  MESSAGE_REACTED = 'message:reacted',
  USER_TYPING = 'user:typing',
  USER_STOPPED_TYPING = 'user:stopped-typing',
  USER_JOINED = 'user:joined',
  USER_LEFT = 'user:left',
  USER_MUTED = 'user:muted',
  USER_UNMUTED = 'user:unmuted',
  MESSAGE_READ = 'message:read',
}

export enum MessageType {
  TEXT = 'TEXT',
  SYSTEM = 'SYSTEM',
  EMOJI_REACTION = 'EMOJI_REACTION',
  LINK_PREVIEW = 'LINK_PREVIEW',
  USER_MENTION = 'USER_MENTION',
}

// Interfaces for rich chat features
export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface RichMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  type: MessageType;
  roomId?: string;
  gameId?: string;
  mentions?: string[];
  links?: string[];
  reactions?: MessageReaction[];
  readBy?: string[];
  edited?: boolean;
  editedAt?: Date;
  createdAt: Date;
}

export interface UserPresenceStatus {
  userId: string;
  displayName: string;
  status: 'online' | 'idle' | 'offline';
  roomId?: string;
  gameId?: string;
  lastSeen: Date;
}

export interface ChatEventPayload {
  type: ChatEventType;
  userId: string;
  roomId?: string;
  gameId?: string;
  data: any;
  timestamp: string;
}

@Injectable()
export class ChatServiceEnhanced implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatServiceEnhanced.name);
  private eventEmitter: EventEmitter;
  private typingUsers = new Map<string, NodeJS.Timeout>();
  private presenceCheckInterval: NodeJS.Timeout | null = null;
  private messageCache = new Map<string, RichMessage[]>();

  constructor(
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(UserBan) private readonly banRepo: Repository<UserBan>,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100);
  }

  async onModuleInit() {
    this.logger.log('Initializing enhanced chat service with real-time support');
    // Start presence cleanup loop
    this.presenceCheckInterval = setInterval(() => this.cleanupStalePresence(), PRESENCE_CHECK_INTERVAL);
  }

  async onModuleDestroy() {
    if (this.presenceCheckInterval) {
      clearInterval(this.presenceCheckInterval);
    }
    this.eventEmitter.removeAllListeners();
    this.typingUsers.forEach(timeout => clearTimeout(timeout));
    this.typingUsers.clear();
  }

  /**
   * Main method to send a message with full validation and moderation
   */
  async sendMessage({
    userId,
    displayName,
    text,
    roomId,
    gameId,
  }: {
    userId: string;
    displayName: string;
    text: string;
    roomId?: string;
    gameId?: string;
  }): Promise<{
    message: RichMessage | null;
    banned: boolean;
    banReason?: string;
    banUntil?: Date;
    violation?: string;
  }> {
    try {
      // Check active ban
      const activeBan = await this.getActiveBan(userId);
      if (activeBan) {
        return {
          message: null,
          banned: true,
          banReason: 'You are currently banned',
          banUntil: activeBan.until,
        };
      }

      // Check if user is muted
      const isMuted = await this.isUserMuted(userId, roomId, gameId);
      if (isMuted) {
        return {
          message: null,
          banned: false,
          violation: 'You are muted in this room',
        };
      }

      // Rate limiting
      const rateLimitExceeded = await this.checkRateLimit(userId);
      if (rateLimitExceeded) {
        return {
          message: null,
          banned: false,
          violation: 'Too many messages. Please slow down.',
        };
      }

      // Spam detection (similar messages in a row)
      const isSpam = await this.detectSpam(userId, text);
      if (isSpam) {
        return {
          message: null,
          banned: false,
          violation: 'Spam detected. Message discarded.',
        };
      }

      // Sanitize message
      const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
      const { clean, violations, hasMentions } = this.moderateText(trimmed);

      let banned = false;
      let banReason: string | undefined;
      let banUntil: Date | undefined;

      // Process violations
      if (violations.length > 0) {
        const strikeResult = await this.addStrike(userId, violations.join(', '));
        this.logger.warn(
          `User ${userId} received strike ${strikeResult.strikes}/${MAX_STRIKES} for: ${violations.join(', ')}`,
        );

        if (strikeResult.strikes >= MAX_STRIKES) {
          const banResult = await this.banUser(userId, strikeResult.banCount);
          banned = true;
          banReason = `Banned for language violations (${banResult.durationHours}h)`;
          banUntil = banResult.until;
        }
      }

      // Save message to database
      const savedMsg = await this.msgRepo.save({
        userId,
        displayName,
        text: clean,
        rawText: trimmed,
        roomId,
        gameId,
        hadViolation: violations.length > 0,
        createdAt: new Date(),
      });

      // Create rich message object
      const richMessage: RichMessage = {
        id: savedMsg.id.toString(),
        userId,
        displayName,
        text: clean,
        type: MessageType.TEXT,
        roomId,
        gameId,
        mentions: hasMentions ? this.extractMentions(clean) : undefined,
        reactions: [],
        readBy: [userId], // Sender has read their own message
        createdAt: savedMsg.createdAt,
      };

      // Emit real-time event
      this.emitChatEvent({
        type: ChatEventType.MESSAGE_SENT,
        userId,
        roomId,
        gameId,
        data: richMessage,
        timestamp: new Date().toISOString(),
      });

      // Cache message
      await this.cacheMessage(roomId || gameId || 'global', richMessage);

      return {
        message: richMessage,
        banned,
        banReason,
        banUntil,
      };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add/edit reaction to a message
   */
  async reactToMessage(
    messageId: string,
    userId: string,
    emoji: string,
    roomId?: string,
    gameId?: string,
  ): Promise<RichMessage | null> {
    if (emoji.length > 2) {
      this.logger.warn(`Emoji too long: ${emoji}`);
      return null;
    }

    try {
      const reactionKey = `chat:reactions:${messageId}`;
      const userEmojiKey = `chat:reactions:${messageId}:${userId}`;

      // Store emoji reaction in Redis for quick access
      await this.redis.sadd(`${userEmojiKey}`, emoji);
      await this.redis.expire(`${userEmojiKey}`, 60 * 60 * 24 * 7); // 7 days

      const reactions = await this.getMessageReactions(messageId);

      // Emit reaction event
      this.emitChatEvent({
        type: ChatEventType.MESSAGE_REACTED,
        userId,
        roomId,
        gameId,
        data: { messageId, emoji, reactions },
        timestamp: new Date().toISOString(),
      });

      return null;
    } catch (error) {
      this.logger.error(`Error reacting to message: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all reactions on a message
   */
  async getMessageReactions(messageId: string): Promise<MessageReaction[]> {
    const reactions: MessageReaction[] = [];
    const pattern = `chat:reactions:${messageId}:*`;
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const userId = key.split(':').pop();
      const emojis = await this.redis.smembers(key);

      for (const emoji of emojis) {
        const existing = reactions.find(r => r.emoji === emoji);
        if (existing) {
          existing.userIds.push(userId);
        } else {
          reactions.push({ emoji, userIds: [userId] });
        }
      }
    }

    return reactions;
  }

  /**
   * Mark message as read by user
   */
  async markMessageAsRead(messageId: string, userId: string, roomId?: string): Promise<void> {
    const readKey = `chat:read:${messageId}`;
    await this.redis.sadd(readKey, userId);
    await this.redis.expire(readKey, 60 * 60 * 24); // 24 hours

    this.emitChatEvent({
      type: ChatEventType.MESSAGE_READ,
      userId,
      roomId,
      data: { messageId },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get who has read a message
   */
  async getMessageReaders(messageId: string): Promise<string[]> {
    const readKey = `chat:read:${messageId}`;
    return this.redis.smembers(readKey);
  }

  /**
   * Send typing indicator
   */
  async setTyping(userId: string, displayName: string, roomId?: string, gameId?: string): Promise<void> {
    // Clear previous typing timeout
    if (this.typingUsers.has(userId)) {
      clearTimeout(this.typingUsers.get(userId)!);
    }

    // Emit typing event
    this.emitChatEvent({
      type: ChatEventType.USER_TYPING,
      userId,
      roomId,
      gameId,
      data: { displayName },
      timestamp: new Date().toISOString(),
    });

    // Set timeout to auto-stop typing after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      this.stopTyping(userId, roomId, gameId);
    }, TYPING_INDICATOR_TIMEOUT);

    this.typingUsers.set(userId, timeout);
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(userId: string, roomId?: string, gameId?: string): Promise<void> {
    if (this.typingUsers.has(userId)) {
      clearTimeout(this.typingUsers.get(userId)!);
      this.typingUsers.delete(userId);
    }

    this.emitChatEvent({
      type: ChatEventType.USER_STOPPED_TYPING,
      userId,
      roomId,
      gameId,
      data: {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update user presence
   */
  async setUserPresence(
    userId: string,
    displayName: string,
    status: 'online' | 'idle' | 'offline',
    roomId?: string,
    gameId?: string,
  ): Promise<void> {
    const presenceKey = `chat:presence:${userId}`;
    const presenceData = {
      userId,
      displayName,
      status,
      roomId,
      gameId,
      lastSeen: new Date().toISOString(),
    };

    await this.redis.set(presenceKey, JSON.stringify(presenceData), 'EX', USER_PRESENCE_TTL);

    this.emitChatEvent({
      type: ChatEventType.USER_JOINED,
      userId,
      roomId,
      gameId,
      data: presenceData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get active users in a room or game
   */
  async getActivePresence(roomId?: string, gameId?: string): Promise<UserPresenceStatus[]> {
    const pattern = 'chat:presence:*';
    const keys = await this.redis.keys(pattern);
    const users: UserPresenceStatus[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const user = JSON.parse(data);
        if (
          (roomId && user.roomId === roomId) ||
          (gameId && user.gameId === gameId) ||
          (!roomId && !gameId)
        ) {
          users.push(user);
        }
      }
    }

    return users;
  }

  /**
   * Mute user in a room or game
   */
  async muteUser(userId: string, roomId?: string, gameId?: string, durationMinutes = 60): Promise<void> {
    const key = `chat:muted:${userId}:${roomId || gameId || 'global'}`;
    await this.redis.set(key, '1', 'EX', durationMinutes * 60);

    this.emitChatEvent({
      type: ChatEventType.USER_MUTED,
      userId,
      roomId,
      gameId,
      data: { durationMinutes },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unmute user
   */
  async unmuteUser(userId: string, roomId?: string, gameId?: string): Promise<void> {
    const key = `chat:muted:${userId}:${roomId || gameId || 'global'}`;
    await this.redis.del(key);

    this.emitChatEvent({
      type: ChatEventType.USER_UNMUTED,
      userId,
      roomId,
      gameId,
      data: {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if user is muted
   */
  private async isUserMuted(userId: string, roomId?: string, gameId?: string): Promise<boolean> {
    const key = `chat:muted:${userId}:${roomId || gameId || 'global'}`;
    const muted = await this.redis.exists(key);
    return muted === 1;
  }

  /**
   * Get chat history with pagination
   */
  async getHistory(
    roomId?: string,
    gameId?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ messages: ChatMessage[]; total: number }> {
    const where: any = {};
    if (roomId) where.roomId = roomId;
    if (gameId) where.gameId = gameId;

    const [messages, total] = await this.msgRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(limit, MAX_HISTORY_LIMIT),
      skip: offset,
    });

    return { messages: messages.reverse(), total };
  }

  /**
   * Edit a message (admin/owner only)
   */
  async editMessage(messageId: string, userId: string, newText: string): Promise<RichMessage | null> {
    try {
      const msg = await this.msgRepo.findOne({ where: { id: parseInt(messageId) } });
      if (!msg || msg.userId !== userId) {
        return null;
      }

      const { clean } = this.moderateText(newText.slice(0, MAX_MESSAGE_LENGTH));
      msg.text = clean;
      msg.rawText = newText;
      msg.editedAt = new Date();

      await this.msgRepo.save(msg);

      const richMessage: RichMessage = {
        id: msg.id.toString(),
        userId: msg.userId,
        displayName: msg.displayName,
        text: clean,
        type: MessageType.TEXT,
        roomId: msg.roomId,
        gameId: msg.gameId,
        edited: true,
        editedAt: msg.editedAt,
        createdAt: msg.createdAt,
      };

      this.emitChatEvent({
        type: ChatEventType.MESSAGE_EDITED,
        userId,
        roomId: msg.roomId,
        gameId: msg.gameId,
        data: richMessage,
        timestamp: new Date().toISOString(),
      });

      return richMessage;
    } catch (error) {
      this.logger.error(`Error editing message: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete a message (admin/owner only)
   */
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const msg = await this.msgRepo.findOne({ where: { id: parseInt(messageId) } });
      if (!msg || msg.userId !== userId) {
        return false;
      }

      await this.msgRepo.delete(msg.id);

      // Clean up reactions
      await this.redis.del(`chat:reactions:${messageId}`);
      await this.redis.del(`chat:read:${messageId}`);

      this.emitChatEvent({
        type: ChatEventType.MESSAGE_DELETED,
        userId,
        roomId: msg.roomId,
        gameId: msg.gameId,
        data: { messageId },
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`);
      return false;
    }
  }

  /**
   * Moderate text and extract violations
   */
  private moderateText(text: string): {
    clean: string;
    violations: string[];
    hasMentions: boolean;
  } {
    const violations: string[] = [];
    let clean = text;
    const hasMentions = /@\w+/g.test(text);

    for (const bannedItem of BANNED_WORDS) {
      const regex = new RegExp(`\\b${bannedItem.word}\\b`, 'gi');
      if (regex.test(text)) {
        violations.push(bannedItem.word);
        clean = clean.replace(regex, '***');
      }
    }

    return { clean, violations, hasMentions };
  }

  /**
   * Extract mentions from text
   */
  private extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  /**
   * Check rate limiting (5 messages per 10 seconds)
   */
  private async checkRateLimit(userId: string): Promise<boolean> {
    const key = `chat:ratelimit:${userId}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, 10); // 10 second window
    }

    return count > MESSAGE_RATE_LIMIT;
  }

  /**
   * Detect spam (similar messages in a row)
   */
  private async detectSpam(userId: string, text: string): Promise<boolean> {
    const key = `chat:spam:${userId}`;
    const lastMessages = await this.redis.lrange(key, 0, SPAM_THRESHOLD);

    // Check if message is similar to recent messages
    const similarity = lastMessages.some(msg => this.calculateSimilarity(msg, text) > 0.8);

    if (similarity) {
      return true;
    }

    // Add message to spam history
    await this.redis.lpush(key, text);
    await this.redis.ltrim(key, 0, SPAM_THRESHOLD - 1);
    await this.redis.expire(key, 60); // 1 minute window

    return false;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const t1 = text1.toLowerCase();
    const t2 = text2.toLowerCase();

    if (t1 === t2) return 1.0;

    const longer = t1.length > t2.length ? t1 : t2;
    const shorter = t1.length > t2.length ? t2 : t1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance for spam detection
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  }

  /**
   * Add strike for violation
   */
  private async addStrike(
    userId: string,
    reason: string,
  ): Promise<{ strikes: number; banCount: number }> {
    const key = `chat:strikes:${userId}`;
    const banCountKey = `chat:bancount:${userId}`;

    const strikes = await this.redis.incr(key);
    if (strikes === 1) {
      await this.redis.expire(key, 60 * 60 * 24 * 7); // 7 day window
    }

    let banCount = 0;
    if (strikes >= MAX_STRIKES) {
      banCount = parseInt((await this.redis.get(banCountKey)) || '0') + 1;
      await this.redis.set(banCountKey, banCount.toString());
      await this.redis.del(key); // Reset strikes after ban
    }

    return { strikes, banCount };
  }

  /**
   * Ban user with progressive duration
   */
  private async banUser(userId: string, banCount: number): Promise<{ durationHours: number; until: Date }> {
    const idx = Math.min(banCount - 1, BAN_DURATIONS_HOURS.length - 1);
    const durationHours = BAN_DURATIONS_HOURS[idx];
    const until = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    await this.banRepo.save({
      userId,
      until,
      reason: 'Language violations',
      createdAt: new Date(),
    });

    await this.redis.set(`chat:ban:${userId}`, until.toISOString(), 'EX', durationHours * 3600);

    this.logger.warn(`User ${userId} banned for ${durationHours}h (ban count: ${banCount})`);
    return { durationHours, until };
  }

  /**
   * Check if user has active ban
   */
  private async getActiveBan(userId: string): Promise<{ until: Date } | null> {
    const raw = await this.redis.get(`chat:ban:${userId}`);
    if (!raw) return null;

    const until = new Date(raw);
    if (until > new Date()) return { until };

    // Ban expired, clean up
    await this.redis.del(`chat:ban:${userId}`);
    return null;
  }

  /**
   * Admin: manually ban user
   */
  async manualBan(userId: string, hours: number, reason: string): Promise<void> {
    const until = new Date(Date.now() + hours * 3600 * 1000);
    await this.banRepo.save({
      userId,
      until,
      reason,
      createdAt: new Date(),
    });
    await this.redis.set(`chat:ban:${userId}`, until.toISOString(), 'EX', hours * 3600);
  }

  /**
   * Admin: unban user
   */
  async unban(userId: string): Promise<void> {
    await this.redis.del(`chat:ban:${userId}`);
    await this.banRepo.update({ userId }, { until: new Date() });
  }

  /**
   * Cache message for quick retrieval
   */
  private async cacheMessage(context: string, message: RichMessage): Promise<void> {
    const key = `chat:cache:${context}`;
    const cached = this.messageCache.get(context) || [];
    cached.push(message);

    // Keep only last 50 messages in cache
    if (cached.length > 50) {
      cached.shift();
    }

    this.messageCache.set(context, cached);
  }

  /**
   * Clean up stale user presence
   */
  private async cleanupStalePresence(): Promise<void> {
    const pattern = 'chat:presence:*';
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) {
        await this.redis.del(key);
      }
    }

    this.logger.debug(`Cleaned up stale presence data. Keys checked: ${keys.length}`);
  }

  /**
   * Register event listener (for WebSocket gateway)
   */
  onChatEvent(listener: (payload: ChatEventPayload) => void): void {
    this.eventEmitter.on('chat:event', listener);
  }

  /**
   * Unregister event listener
   */
  offChatEvent(listener: (payload: ChatEventPayload) => void): void {
    this.eventEmitter.off('chat:event', listener);
  }

  /**
   * Emit chat event internally
   */
  private emitChatEvent(payload: ChatEventPayload): void {
    this.eventEmitter.emit('chat:event', payload);
    this.logger.debug(`Chat event emitted: ${payload.type} from ${payload.userId}`);
  }

  /**
   * Get real-time event emitter (for WebSocket integration)
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
}
