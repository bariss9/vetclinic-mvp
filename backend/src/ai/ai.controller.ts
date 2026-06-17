import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { DiagnoseDto } from './ai.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('diagnose')
  diagnose(@Body() dto: DiagnoseDto) {
    return this.aiService.diagnose(dto);
  }
}
