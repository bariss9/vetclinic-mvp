import { Controller, Post, Body } from '@nestjs/common';
import { AnamnesisService } from './anamnesis.service';
import { ChatDto, SaveAnamnesisDto, NextQuestionDto, ValidateAnswerDto } from './anamnesis.dto';

@Controller('anamnesis')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Post('next-question')
  nextQuestion(@Body() dto: NextQuestionDto) {
    return this.anamnesisService.nextQuestion(dto);
  }

  @Post('validate-answer')
  validateAnswer(@Body() dto: ValidateAnswerDto) {
    return this.anamnesisService.validateAnswer(dto);
  }

  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.anamnesisService.chat(dto);
  }

  @Post('save')
  save(@Body() dto: SaveAnamnesisDto) {
    return this.anamnesisService.save(dto);
  }
}
