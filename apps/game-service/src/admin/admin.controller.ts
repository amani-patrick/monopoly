import { Controller, Get, Post, Body, Param, Req, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { XUserGuard } from '../guards/x-user.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(XUserGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  private assertAdmin(req: any) {
    if (req.user?.role !== 'admin') throw new BadRequestException('Forbidden');
  }

  private assertStaff(req: any) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'moderator') {
      throw new BadRequestException('Staff access required');
    }
  }

  @Get('dashboard')
  async dashboard(@Req() req: any) {
    this.assertAdmin(req);
    return this.admin.getDashboard();
  }

  @Get('review-queue')
  async reviewQueue(@Req() req: any) {
    this.assertStaff(req);
    return this.admin.getReviewQueue();
  }

  @Post('confirm-violation')
  @HttpCode(HttpStatus.OK)
  async confirmViolation(@Req() req: any, @Body() body: { userId: string; type: string }) {
    this.assertStaff(req);
    await this.admin.confirmViolation(body.userId, body.type);
    return { success: true };
  }

  @Post('clear-violations')
  @HttpCode(HttpStatus.OK)
  async clearViolations(@Req() req: any, @Body() body: { userId: string }) {
    this.assertStaff(req);
    await this.admin.clearViolations(body.userId);
    return { success: true };
  }
}
