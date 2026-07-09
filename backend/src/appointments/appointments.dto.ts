import { IsInt, IsString, IsNotEmpty, IsDateString, IsEnum, IsOptional, IsNumber, Matches } from 'class-validator';

export class CreateAppointmentDto {
  @IsInt()
  patientId: number;

  @IsDateString()
  date: string;

  @IsString()
  reason: string;

  @IsString()
  @IsOptional()
  clinicName?: string;

  @IsString()
  @IsOptional()
  clinicAddress?: string;

  @IsNumber()
  @IsOptional()
  clinicLat?: number;

  @IsNumber()
  @IsOptional()
  clinicLon?: number;

  @IsString()
  @IsOptional()
  anamnesisId?: string;
}

export class AvailableSlotsQueryDto {
  @IsString()
  @IsNotEmpty()
  clinicName: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date YYYY-MM-DD formatında olmalı' })
  date: string;
}

export class UpdateAppointmentDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsEnum(['PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'UNCERTAIN'])
  @IsOptional()
  status?: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'UNCERTAIN';
}
