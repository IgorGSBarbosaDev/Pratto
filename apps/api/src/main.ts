import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loadEnvironment } from '@pratto/config';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { RequestIdInterceptor } from './common/http/request-id.interceptor';

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableCors({ origin: environment.WEB_URL, credentials: true });
  app.setGlobalPrefix('');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pratto API')
    .setDescription('REST API for the Pratto digital menu')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(environment.API_PORT);
}

void bootstrap();
