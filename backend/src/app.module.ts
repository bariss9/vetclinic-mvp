import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AiModule } from './ai/ai.module';
import { AnamnesisModule } from './anamnesis/anamnesis.module';

@Module({
  imports: [PrismaModule, UsersModule, PatientsModule, MedicalRecordsModule, AppointmentsModule, AiModule, AnamnesisModule],
})
export class AppModule {}
