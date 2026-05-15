import { Controller, Get } from '@nestjs/common';

@Controller()
export class BotController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'bot-service', ts: new Date().toISOString() };
  }
}
