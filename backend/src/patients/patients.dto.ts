import { IsString, IsInt, Min, IsOptional } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  name: string;

  @IsString()
  species: string;

  @IsString()
  breed: string;

  @IsInt()
  @Min(0)
  age: number;

  @IsInt()
  ownerId: number;
}

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  species?: string;

  @IsString()
  @IsOptional()
  breed?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  age?: number;
}
