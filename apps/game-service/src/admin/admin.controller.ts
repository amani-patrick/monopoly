import { Controller, Get, Post, Body, Param, Req, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== 'admin') throw new BadRequestException('Forbidden');
  }

  @Get('dashboard')
  async dashboard(@Req() req: any) {
    this.assertAdmin(req);
    return this.admin.getDashboard();
  }

  @Get('review-queue')
  async reviewQueue(@Req() req: any) {
    this.assertAdmin(req);
    return this.admin.getReviewQueue();
  }

  @Post('confirm-violation')
  @HttpCode(HttpStatus.OK)
  async confirmViolation(@Req() req: any, @Body() body: { userId: string; type: string }) {
    this.assertAdmin(req);
    await this.admin.confirmViolation(body.userId, body.type);
    return { success: true };
  }

  @Post('clear-violations')
  @HttpCode(HttpStatus.OK)
  async clearViolations(@Req() req: any, @Body() body: { userId: string }) {
    this.assertAdmin(req);
    await this.admin.clearViolations(body.userId);
    return { success: true };
  }
}
