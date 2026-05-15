import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import * as compression from 'compression';

/**
 * Shared bootstrap for all NestJS microservices.
 * Call from each service's main.ts:
 *   bootstrapService(AppModule, 3002, 'GameService');
 */
export async function bootstrapService(
  AppModule: any,
  defaultPort: number,
  serviceName: string,
): Promise<INestApplication> {
  const logger = new Logger(serviceName);
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bufferLogs: true,
  });

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  // Only accept calls from the API gateway (internal network in Docker)
  const allowedOrigins = [
    process.env.API_GATEWAY_URL  || 'http://localhost:4000',
    process.env.FRONTEND_URL     || 'http://localhost:3000',
    process.env.WS_GATEWAY_URL   || 'http://localhost:3003',
  ];
  app.enableCors({ origin: allowedOrigins, credentials: true });

  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  const port = parseInt(process.env.PORT || String(defaultPort));
  await app.listen(port);
  logger.log(`${serviceName} running → http://localhost:${port}`);
  return app;
}
