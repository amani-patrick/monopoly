import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import * as path from 'path';
import { BotService } from './bot/bot.service';
import { BotController } from './bot/bot.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: [path.resolve(__dirname, '../../.env'), '.env'],
    }),
    HttpModule,
  ],
  controllers: [BotController],
  providers: [BotService],
})
export class AppModule {}
