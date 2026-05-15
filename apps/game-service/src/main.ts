import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error','warn','log'] });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.enableCors({ origin: [process.env.API_GATEWAY_URL||'http://localhost:4000', process.env.WS_GATEWAY_URL||'http://localhost:3003'], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT || 3002);
  new Logger('GameService').log(`Game service running on port ${process.env.PORT || 3002}`);
}
bootstrap().catch((e: any) => { console.error(e); process.exit(1); });

