import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AiModule } from './ai/ai.module';
import { AnamnesisModule } from './anamnesis/anamnesis.module';
import { VaccinationsModule } from './vaccinations/vaccinations.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Rate limiting varsayılanı — ThrottlerGuard yalnızca /auth controller'ında aktif,
    // rota bazlı limitler @Throttle ile override edilir (bkz. users.controller.ts)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    PrismaModule, MailModule, UsersModule, PatientsModule, MedicalRecordsModule, AppointmentsModule, AiModule, AnamnesisModule, VaccinationsModule,
  ],
})
export class AppModule {}
