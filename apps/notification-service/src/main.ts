import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error','warn','log'] });
  app.use(helmet({ contentSecurityPolicy: false }));
  await app.listen(process.env.PORT || 3007);
  new Logger('NotificationService').log(`Notification service running on port ${process.env.PORT || 3007}`);
}
bootstrap().catch(e => { console.error(e); process.exit(1); });
