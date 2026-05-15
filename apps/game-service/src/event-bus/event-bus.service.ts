import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { REDIS_CHANNELS } from '@umukino/shared-events';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async publish(event: string, data: Record<string, unknown>): Promise<void> {
    const payload = JSON.stringify({ event, data, ts: new Date().toISOString() });
    try {
      await this.redis.publish(REDIS_CHANNELS.GAME_EVENTS, payload);
    } catch (e: any) {
      this.logger.error(`Failed to publish event ${event}: ${e.message}`);
    }
  }

  async publishPayment(event: string, data: Record<string, unknown>): Promise<void> {
    const payload = JSON.stringify({ event, data, ts: new Date().toISOString() });
    try {
      await this.redis.publish(REDIS_CHANNELS.PAYMENT_EVENTS, payload);
    } catch (e: any) {
      this.logger.error(`Failed to publish payment ${event}: ${e.message}`);
    }
  }

  async publishNotification(event: string, data: Record<string, unknown>): Promise<void> {
    const payload = JSON.stringify({ event, data, ts: new Date().toISOString() });
    try {
      await this.redis.publish(REDIS_CHANNELS.NOTIFICATION_EVENTS, payload);
    } catch (e: any) {
      this.logger.error(`Failed to publish notification ${event}: ${e.message}`);
    }
  }
}
