import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BotService } from './bot/bot.service';
import { BotController } from './bot/bot.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
  ],
  controllers: [BotController],
  providers: [BotService],
})
export class AppModule {}
