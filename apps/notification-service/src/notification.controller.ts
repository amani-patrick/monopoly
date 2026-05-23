import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { XUserGuard } from './guards/x-user.guard';

@Controller()
export class NotificationController {
  constructor(private readonly notif: NotificationService) {}

  @Get('health')
  health() { return { status: 'ok', service: 'notification-service', ts: new Date().toISOString() }; }

  @Post('notify/email')
  @UseGuards(XUserGuard)
  async sendEmail(@Body() body: { to: string; subject: string; html: string }) {
    await this.notif.sendEmail(body.to, body.subject, body.html);
    return { success: true };
  }

  @Post('notify/welcome')
  async sendWelcome(@Body() body: { email: string; displayName: string }) {
    await this.notif.sendWelcomeEmail(body.email, body.displayName);
    return { success: true };
  }
}
