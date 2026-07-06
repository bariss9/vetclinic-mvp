import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  controllers: [AiController],
  providers: [AiService, JwtAuthGuard],
})
export class AiModule {}
