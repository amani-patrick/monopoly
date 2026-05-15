import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import * as compression from 'compression';

const logger = new Logger('AuthService');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  // Security
  app.use(helmet({
    contentSecurityPolicy: false, // handled by Next.js
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(compression());

  // CORS — only allow gateway and frontend
  app.enableCors({
    origin: [
      process.env.API_GATEWAY_URL || 'http://localhost:4000',
      process.env.FRONTEND_URL    || 'http://localhost:3000',
    ],
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Global prefix
  app.setGlobalPrefix('');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Auth service running on port ${port}`);
}

bootstrap().catch(err => {
  logger.error('Auth service failed to start', err);
  process.exit(1);
});
