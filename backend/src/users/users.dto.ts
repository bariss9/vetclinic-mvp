import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(['VET', 'ADMIN'])
  @IsOptional()
  role?: 'VET' | 'ADMIN';
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
