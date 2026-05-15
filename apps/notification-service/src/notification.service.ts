import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import { REDIS_CHANNELS } from '@umukino/shared-events';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.setupMailer();
    this.subscribeToEvents();
  }

  private setupMailer() {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  private subscribeToEvents() {
    const sub = this.redis.duplicate();
    sub.subscribe(REDIS_CHANNELS.PAYMENT_EVENTS, REDIS_CHANNELS.NOTIFICATION_EVENTS);

    sub.on('message', async (channel, message) => {
      try {
        const payload = JSON.parse(message);
        await this.handleEvent(payload);
      } catch (err) {
        this.logger.error('Notification event error:', err);
      }
    });

    this.logger.log('Notification service subscribed to Redis events');
  }

  private async handleEvent(payload: { event: string; userId?: string; data: any }) {
    switch (payload.event) {
      case 'payment.confirmed':
        await this.sendDepositConfirmation(payload.userId!, payload.data);
        break;
      case 'wallet.updated':
        if (payload.data.type === 'prize') {
          await this.sendPrizeNotification(payload.userId!, payload.data);
        }
        break;
      case 'notify.email':
        await this.sendEmail(payload.data.to, payload.data.subject, payload.data.html);
        break;
    }
  }

  // ============================================================
  // EMAIL NOTIFICATIONS
  // ============================================================

  async sendDepositConfirmation(userId: string, data: { amount: number; reference: string }) {
    // In production: look up user email from auth service
    this.logger.log(`[NOTIFY] Deposit confirmed for user ${userId}: ${data.amount} RWF (${data.reference})`);
    // await this.sendEmail(userEmail, 'Deposit Confirmed', this.depositTemplate(data));
  }

  async sendPrizeNotification(userId: string, data: { amount: number; roomId: string }) {
    this.logger.log(`[NOTIFY] Prize credited to user ${userId}: ${data.amount} RWF from room ${data.roomId}`);
  }

  async sendWelcomeEmail(email: string, displayName: string): Promise<void> {
    await this.sendEmail(
      email,
      '🎲 Welcome to Umukino!',
      this.welcomeTemplate(displayName),
    );
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.config.get('FRONTEND_URL')}/auth/reset-password?token=${resetToken}`;
    await this.sendEmail(
      email,
      'Reset your Umukino password',
      this.passwordResetTemplate(resetUrl),
    );
  }

  public async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.config.get('SMTP_USER')) {
      this.logger.debug(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"Umukino" <${this.config.get('SMTP_FROM', 'noreply@umukino.rw')}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent: ${to} — ${subject}`);
    } catch (err) {
      this.logger.error(`Email failed: ${to} — ${err.message}`);
    }
  }

  // ============================================================
  // EMAIL TEMPLATES
  // ============================================================

  private welcomeTemplate(name: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#fff;padding:32px;border-radius:12px">
        <h1 style="color:#a855f7">🎲 Murakaza neza kuri Umukino!</h1>
        <p>Muraho <strong>${name}</strong>,</p>
        <p>Your account is ready. Deposit via MTN MoMo, Airtel Money, or USDT to start playing!</p>
        <div style="background:#2d2d4e;padding:16px;border-radius:8px;margin:16px 0">
          <p style="margin:0">🎮 Create a private room and share the link with friends</p>
          <p style="margin:0">💰 Entry fees build a prize pool — winner takes all (minus our 10% cut)</p>
          <p style="margin:0">🏆 Track your rank on the leaderboard</p>
        </div>
        <p>Good luck! <em>Tugire akari!</em></p>
      </div>
    `;
  }

  private depositTemplate(data: { amount: number; reference: string }): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#22c55e">✅ Deposit Confirmed</h2>
        <p>Your deposit of <strong>${data.amount.toLocaleString()} RWF</strong> has been credited to your wallet.</p>
        <p style="color:#888;font-size:12px">Reference: ${data.reference}</p>
      </div>
    `;
  }

  private passwordResetTemplate(url: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#a855f7">🔑 Reset Your Password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${url}" style="display:inline-block;background:#a855f7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">Reset Password</a>
        <p style="color:#888;font-size:12px">If you didn't request this, ignore this email.</p>
      </div>
    `;
  }
}

