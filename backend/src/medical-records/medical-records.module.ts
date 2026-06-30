import { Module } from '@nestjs/common';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService, JwtAuthGuard],
})
export class MedicalRecordsModule {}
