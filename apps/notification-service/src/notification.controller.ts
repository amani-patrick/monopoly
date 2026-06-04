import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { XUserGuard } from './guards/x-user.guard';

@Controller()
export class NotificationController {
  constructor(private readonly notif: NotificationService) {}

  @Get('health')
  health() { return { status: 'ok', service: 'notification-service', ts: new Date().toISOString() }; }

  // ---- Internal: called by auth-service ----

  @Post('internal/notify/otp')
  async sendOtp(@Body() body: { email: string; displayName: string; code: string }) {
    await this.notif.sendOtpEmail(body.email, body.displayName, body.code);
    return { success: true };
  }

  @Post('internal/notify/welcome')
  async sendWelcome(@Body() body: { email: string; displayName: string }) {
    await this.notif.sendWelcomeEmail(body.email, body.displayName);
    return { success: true };
  }

  @Post('internal/notify/password-reset')
  async sendPasswordReset(@Body() body: { email: string; displayName: string; resetToken: string }) {
    await this.notif.sendPasswordResetEmail(body.email, body.displayName, body.resetToken);
    return { success: true };
  }

  // ---- Authenticated: generic email ----

  @Post('notify/email')
  @UseGuards(XUserGuard)
  async sendEmail(@Body() body: { to: string; subject: string; html: string }) {
    await this.notif.sendEmail(body.to, body.subject, body.html);
    return { success: true };
  }
}
