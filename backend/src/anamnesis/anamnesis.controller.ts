import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AnamnesisService } from './anamnesis.service';
import { ChatDto, SaveAnamnesisDto, NextQuestionDto, ValidateAnswerDto } from './anamnesis.dto';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';

type AuthRequest = Request & { user: JwtPayload };

@UseGuards(JwtAuthGuard)
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
  save(@Body() dto: SaveAnamnesisDto, @Req() req: AuthRequest) {
    return this.anamnesisService.save(dto, req.user.sub, req.user.role);
  }
}
