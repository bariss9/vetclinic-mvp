import { BadRequestException, Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { VaccinationsService } from './vaccinations.service';
import { CreateVaccinationDto, UpdateVaccinationDto } from './vaccinations.dto';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';

type AuthRequest = Request & { user: JwtPayload };

@UseGuards(JwtAuthGuard)
@Controller('vaccinations')
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  @Get()
  findAll(@Query('patientId') patientId: string | undefined, @Req() req: AuthRequest) {
    let parsed: number | undefined;
    if (patientId !== undefined) {
      parsed = parseInt(patientId, 10);
      if (isNaN(parsed)) throw new BadRequestException('patientId sayı olmalıdır');
    }
    return this.vaccinationsService.findAll(parsed, req.user.sub, req.user.role);
  }

  @Post()
  create(@Body() dto: CreateVaccinationDto, @Req() req: AuthRequest) {
    return this.vaccinationsService.create(dto, req.user.sub, req.user.role);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVaccinationDto, @Req() req: AuthRequest) {
    return this.vaccinationsService.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.vaccinationsService.remove(id, req.user.sub, req.user.role);
  }
}
