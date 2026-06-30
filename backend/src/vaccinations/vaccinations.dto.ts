import { IsInt, IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';

export class CreateVaccinationDto {
  @IsInt()
  patientId: number;

  @IsString()
  vaccineName: string;

  @IsDateString()
  @IsOptional()
  administeredDate?: string;

  @IsDateString()
  @IsOptional()
  nextDueDate?: string;

  @IsEnum(['PLANNED', 'ADMINISTERED'])
  @IsOptional()
  status?: 'PLANNED' | 'ADMINISTERED';

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateVaccinationDto {
  @IsString()
  @IsOptional()
  vaccineName?: string;

  @IsDateString()
  @IsOptional()
  administeredDate?: string;

  @IsDateString()
  @IsOptional()
  nextDueDate?: string;

  @IsEnum(['PLANNED', 'ADMINISTERED'])
  @IsOptional()
  status?: 'PLANNED' | 'ADMINISTERED';

  @IsString()
  @IsOptional()
  notes?: string;
}
