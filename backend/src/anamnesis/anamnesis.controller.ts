import { Controller, Post, Body } from '@nestjs/common';
import { AnamnesisService } from './anamnesis.service';
import { ChatDto, SaveAnamnesisDto } from './anamnesis.dto';

@Controller('anamnesis')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.anamnesisService.chat(dto);
  }

  @Post('save')
  save(@Body() dto: SaveAnamnesisDto) {
    return this.anamnesisService.save(dto);
  }
}
