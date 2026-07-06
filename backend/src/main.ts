import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Güvenlik: zayıf fallback secret ile asla ayağa kalkma
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET tanımlı değil — backend/.env dosyasını kontrol edin');
  }
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(3000);
}
bootstrap();
