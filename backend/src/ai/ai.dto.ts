import { IsString, IsInt, IsArray, IsIn, Min } from 'class-validator';

export class DiagnoseDto {
  @IsString()
  animalType: string;

  @IsString()
  breed: string;

  @IsInt()
  @Min(0)
  age: number;

  @IsArray()
  @IsString({ each: true })
  symptoms: string[];

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsString()
  @IsIn(['mild', 'moderate', 'severe'])
  severity: 'mild' | 'moderate' | 'severe';

  @IsInt()
  medicalRecordId: number;
}
