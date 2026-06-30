import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './appointments.dto';
import { JwtAuthGuard, JwtPayload } from '../auth/jwt-auth.guard';

type AuthRequest = Request & { user: JwtPayload };

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  findAll(@Query('patientId') patientId: string | undefined, @Req() req: AuthRequest) {
    if (patientId) {
      return this.appointmentsService.findByPatient(Number(patientId), req.user.sub, req.user.role);
    }
    return this.appointmentsService.findAll(req.user.sub, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.appointmentsService.findOne(id, req.user.sub, req.user.role);
  }

  @Post()
  create(@Body() dto: CreateAppointmentDto, @Req() req: AuthRequest) {
    return this.appointmentsService.create(dto, req.user.sub, req.user.role);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAppointmentDto, @Req() req: AuthRequest) {
    return this.appointmentsService.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.appointmentsService.remove(id, req.user.sub, req.user.role);
  }
}
