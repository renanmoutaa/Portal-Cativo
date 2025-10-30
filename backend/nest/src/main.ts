import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module.js';
import dotenv from 'dotenv';

// Corrige caminho para o .env (de '../../.env' para '../.env')
dotenv.config({ path: '../.env' });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.NEST_PORT || 4002);
  await app.listen(port, '0.0.0.0');
  console.log(`[Nest] running on http://localhost:${port}`);
}

bootstrap();