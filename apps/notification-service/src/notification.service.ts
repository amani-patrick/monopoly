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
  private readonly appName = 'Monopoly';

  constructor(
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.setupMailer();
    this.subscribeToEvents();
  }

  private setupMailer() {
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!user || !pass) {
      this.logger.warn('SMTP_USER or SMTP_PASS not set — emails will be logged only');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') || 'smtp.gmail.com',
      port: this.config.get<number>('SMTP_PORT') || 587,
      secure: false,
      auth: { user, pass },
    });

    this.logger.log(`Mailer ready → ${user}`);
  }

  private subscribeToEvents() {
    const sub = this.redis.duplicate();
    sub.subscribe(REDIS_CHANNELS.PAYMENT_EVENTS, REDIS_CHANNELS.NOTIFICATION_EVENTS);

    sub.on('message', async (_channel, message) => {
      try {
        const payload = JSON.parse(message);
        await this.handleEvent(payload);
      } catch (err: any) {
        this.logger.error('Notification event error:', err.message);
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
  // PUBLIC API — called by other services
  // ============================================================

  async sendOtpEmail(email: string, displayName: string, code: string): Promise<void> {
    await this.sendEmail(
      email,
      `${this.appName} — Your verification code`,
      this.otpTemplate(displayName, code),
    );
  }

  async sendWelcomeEmail(email: string, displayName: string): Promise<void> {
    await this.sendEmail(
      email,
      `Welcome to ${this.appName}!`,
      this.welcomeTemplate(displayName),
    );
  }

  async sendPasswordResetEmail(email: string, displayName: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.config.get('FRONTEND_URL') || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    await this.sendEmail(
      email,
      `${this.appName} — Reset your password`,
      this.passwordResetTemplate(displayName, resetUrl),
    );
  }

  async sendDepositConfirmation(userId: string, data: { amount: number; reference: string }) {
    this.logger.log(`[NOTIFY] Deposit confirmed for user ${userId}: ${data.amount} RWF (${data.reference})`);
  }

  async sendPrizeNotification(userId: string, data: { amount: number; roomId: string }) {
    this.logger.log(`[NOTIFY] Prize credited to user ${userId}: ${data.amount} RWF from room ${data.roomId}`);
  }

  public async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
      return;
    }

    const from = this.config.get<string>('SMTP_FROM') || `${this.appName} <pazzoamani@gmail.com>`;

    try {
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log(`Email sent → ${to} | ${subject}`);
    } catch (err: any) {
      this.logger.error(`Email failed → ${to} | ${err.message}`);
    }
  }

  // ============================================================
  // EMAIL TEMPLATES
  // ============================================================

  private otpTemplate(name: string, code: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#1a1a2e;color:#fff;padding:36px;border-radius:12px">
        <h2 style="color:#a855f7;margin-top:0">🎲 ${this.appName}</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your email verification code is:</p>
        <div style="background:#2d2d4e;border-radius:10px;padding:24px;text-align:center;margin:24px 0">
          <span style="font-size:2.4rem;font-weight:900;letter-spacing:0.3em;color:#a855f7">${code}</span>
        </div>
        <p style="color:#aaa;font-size:0.85rem">This code expires in <strong style="color:#fff">30 minutes</strong>. If you didn't request this, ignore the email.</p>
      </div>
    `;
  }

  private welcomeTemplate(name: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#1a1a2e;color:#fff;padding:36px;border-radius:12px">
        <h2 style="color:#a855f7;margin-top:0">🎲 Welcome to ${this.appName}!</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your account is ready. Deposit via MTN MoMo, Airtel Money, or USDT to start playing!</p>
        <div style="background:#2d2d4e;padding:16px;border-radius:8px;margin:20px 0;line-height:1.8">
          <p style="margin:0">🎮 Create a private room and invite friends</p>
          <p style="margin:0">💰 Entry fees build a prize pool — winner takes all</p>
          <p style="margin:0">🏆 Climb the leaderboard</p>
        </div>
        <p>Good luck! <em>Tugire akari!</em></p>
      </div>
    `;
  }

  private passwordResetTemplate(name: string, url: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#1a1a2e;color:#fff;padding:36px;border-radius:12px">
        <h2 style="color:#a855f7;margin-top:0">🔑 Reset Your Password</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${url}" style="display:inline-block;background:#a855f7;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem">Reset Password</a>
        </div>
        <p style="color:#aaa;font-size:0.85rem">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;
  }
}
