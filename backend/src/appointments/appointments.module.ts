import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, RemindersService, JwtAuthGuard],
})
export class AppointmentsModule {}
