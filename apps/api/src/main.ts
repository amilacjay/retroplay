import 'reflect-metadata';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(existsSync);
if (envPath) config({ path: envPath });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5173', credentials: true, allowedHeaders: ['Content-Type', 'X-Cassete-CSRF'] });
  app.enableShutdownHooks();
  // Containers set API_HOST=0.0.0.0; locally the API stays on loopback behind the Vite proxy.
  await app.listen(Number(process.env.API_PORT ?? 3000), process.env.API_HOST ?? '127.0.0.1');
}
void bootstrap();
