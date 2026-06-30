import { Module } from '@nestjs/common';
import { VaccinationsController } from './vaccinations.controller';
import { VaccinationsService } from './vaccinations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  controllers: [VaccinationsController],
  providers: [VaccinationsService, JwtAuthGuard],
})
export class VaccinationsModule {}
