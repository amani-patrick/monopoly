import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class LeaderboardController {
  constructor(private readonly lb: LeaderboardService) {}

  @Get('health')
  health() { return { status: 'ok', service: 'leaderboard-service', ts: new Date().toISOString() }; }

  @Get('leaderboard')
  async getLeaderboard(@Query('type') type = 'wins', @Query('limit') limit = '50') {
    if (type === 'winrate') return this.lb.getWinRateLeaderboard(parseInt(limit));
    return this.lb.getGlobalLeaderboard(parseInt(limit));
  }

  @Get('leaderboard/players/:userId')
  async getPlayerStats(@Param('userId') userId: string) {
    return this.lb.getPlayerStats(userId);
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
