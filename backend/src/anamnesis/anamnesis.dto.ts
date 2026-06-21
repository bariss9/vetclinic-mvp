import { IsString, IsInt, IsArray, ValidateNested, IsIn, IsObject, IsOptional, Min, Max } from 'class-validator';
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

export class NextQuestionDto {
  @IsInt()
  patientId: number;
}

export class ValidateAnswerDto {
  @IsInt()
  @Min(0)
  @Max(6)
  questionIndex: number;

  @IsString()
  answer: string;
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
