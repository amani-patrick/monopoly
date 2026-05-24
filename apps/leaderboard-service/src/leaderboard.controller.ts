import { Controller, Get, Query, Param, BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller()
export class LeaderboardController {
  constructor(private readonly lb: LeaderboardService) {}

  private parseLimit(limit: string): number {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return Math.min(parsed, 100);
  }

  @Get('health')
  health() { return { status: 'ok', service: 'leaderboard-service', ts: new Date().toISOString() }; }

  @Get('leaderboard')
  async getLeaderboard(@Query('type') type = 'wins', @Query('limit') limit = '50') {
    const normalizedLimit = this.parseLimit(limit);
    if (type === 'winrate') return this.lb.getWinRateLeaderboard(normalizedLimit);
    if (type !== 'wins') throw new BadRequestException('Invalid leaderboard type');
    return this.lb.getGlobalLeaderboard(normalizedLimit);
  }

  @Get('leaderboard/players/:userId')
  async getPlayerStats(@Param('userId') userId: string) {
    const stats = await this.lb.getPlayerStats(userId);
    if (!stats) {
      throw new NotFoundException('Player statistics not found');
    }
    return stats;
  }

  @Get('leaderboard/players/:userId/history')
  async getPlayerHistory(@Param('userId') userId: string, @Query('page') page = '1') {
    return this.lb.getPlayerHistory(userId, parseInt(page));
  }

  @Get('leaderboard/recent')
  async getRecentGames(@Query('limit') limit = '20') {
    return this.lb.getRecentGames(parseInt(limit));
  }
}
