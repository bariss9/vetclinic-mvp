import { IsString, IsInt, IsArray, ValidateNested, IsIn, IsObject, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsIn(['user', 'model'])
  role: 'user' | 'model';

  @IsString()
  text: string;
}

export class ChatDto {
  @IsString()
  message: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history: ChatMessageDto[];

  @IsInt()
  patientId: number;
}

export class SaveAnamnesisDto {
  @IsInt()
  patientId: number;

  @IsObject()
  anamnesis: Record<string, unknown>;

  @IsString()
  @IsOptional()
  notes?: string;
}
