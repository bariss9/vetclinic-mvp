import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AiService } from './ai.service';
import { DiagnoseDto } from './ai.dto';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';

type AuthRequest = Request & { user: JwtPayload };

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('diagnose')
  diagnose(@Body() dto: DiagnoseDto, @Req() req: AuthRequest) {
    return this.aiService.diagnose(dto, req.user.sub, req.user.role);
  }
}
