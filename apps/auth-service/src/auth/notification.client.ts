import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { LOCAL_SERVICE_URLS } from '@umukino/shared-types';

/**
 * Thin HTTP client for calling the notification-service.
 * All calls are fire-and-forget from auth's perspective —
 * failures are logged but never bubble up to the user.
 */
@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);
  private readonly base: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.base = this.config.get<string>('NOTIFICATION_SERVICE_URL') || LOCAL_SERVICE_URLS.notification;
  }

  async sendOtp(email: string, displayName: string, code: string): Promise<void> {
    await this.post('/internal/notify/otp', { email, displayName, code });
  }

  async sendWelcome(email: string, displayName: string): Promise<void> {
    await this.post('/internal/notify/welcome', { email, displayName });
  }

  async sendPasswordReset(email: string, displayName: string, resetToken: string): Promise<void> {
    await this.post('/internal/notify/password-reset', { email, displayName, resetToken });
  }

  private async post(path: string, body: Record<string, string>): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}${path}`, body, { timeout: 5000 }),
      );
    } catch (err: any) {
      // Never fail the caller — email is best-effort
      this.logger.warn(`Notification call failed [${path}]: ${err.message}`);
    }
  }
}
