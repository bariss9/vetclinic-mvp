import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, JwtAuthGuard],
})
export class PatientsModule {}
