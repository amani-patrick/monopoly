import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error','warn','log'] });
  app.enableCors({
    origin: [process.env.FRONTEND_URL||'http://localhost:3000'],
    credentials: true,
  });
  await app.listen(process.env.PORT || 3003);
  new Logger('WsGateway').log(`WebSocket gateway running on port ${process.env.PORT || 3003}`);
}
bootstrap().catch(e => { console.error(e); process.exit(1); });
