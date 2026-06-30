import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, JwtAuthGuard],
})
export class AppointmentsModule {}
