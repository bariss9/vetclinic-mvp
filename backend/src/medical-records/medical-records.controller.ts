import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-records.dto';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';

type AuthRequest = Request & { user: JwtPayload };

@UseGuards(JwtAuthGuard)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Get()
  findAll(@Query('patientId') patientId: string | undefined, @Req() req: AuthRequest) {
    if (patientId) {
      return this.medicalRecordsService.findByPatient(Number(patientId), req.user.sub, req.user.role);
    }
    return this.medicalRecordsService.findAll(req.user.sub, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.medicalRecordsService.findOne(id, req.user.sub, req.user.role);
  }

  @Post()
  create(@Body() dto: CreateMedicalRecordDto, @Req() req: AuthRequest) {
    return this.medicalRecordsService.create(dto, req.user.sub, req.user.role);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMedicalRecordDto, @Req() req: AuthRequest) {
    return this.medicalRecordsService.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.medicalRecordsService.remove(id, req.user.sub, req.user.role);
  }
}
