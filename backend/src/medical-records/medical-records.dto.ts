import { IsArray, IsString, IsOptional, IsInt, IsObject } from 'class-validator';

export class CreateMedicalRecordDto {
  @IsInt()
  patientId: number;

  @IsArray()
  @IsString({ each: true })
  symptoms: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  aiResult?: Record<string, unknown>;
}

export class UpdateMedicalRecordDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  symptoms?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  aiResult?: Record<string, unknown>;
}
