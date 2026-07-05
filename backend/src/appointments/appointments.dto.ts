import { IsInt, IsString, IsDateString, IsEnum, IsOptional, IsNumber } from 'class-validator';

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
