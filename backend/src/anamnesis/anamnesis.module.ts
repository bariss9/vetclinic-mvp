import { Module } from '@nestjs/common';
import { AnamnesisController } from './anamnesis.controller';
import { AnamnesisService } from './anamnesis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  controllers: [AnamnesisController],
  providers: [AnamnesisService, JwtAuthGuard],
})
export class AnamnesisModule {}
