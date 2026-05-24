import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error','warn','log'] });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  // Remove x-user from allowedHeaders — it's an internal header set by the gateway,
  // never accepted from browser clients. Downstream services trust it only from the gateway.
  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT || 4000);
  new Logger('ApiGateway').log(`API Gateway running on port ${process.env.PORT || 4000}`);
}
bootstrap().catch((e: any) => { console.error(e); process.exit(1); });

