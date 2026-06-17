import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './appointments.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolvePatient(patientId: number) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException(`Patient #${patientId} not found`);
    return patient;
  }

  private async resolveAppointment(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: { select: { id: true, name: true, ownerId: true } } },
    });
    if (!appointment) throw new NotFoundException(`Appointment #${id} not found`);
    return appointment;
  }

  findAll() {
    return this.prisma.appointment.findMany({
      include: { patient: { select: { id: true, name: true, ownerId: true } } },
      orderBy: { date: 'asc' },
    });
  }

  findByPatient(patientId: number) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: 'asc' },
    });
  }

  findOne(id: number) {
    return this.resolveAppointment(id);
  }

  async create(dto: CreateAppointmentDto) {
    await this.resolvePatient(dto.patientId);
    return this.prisma.appointment.create({
      data: {
        patientId:     dto.patientId,
        date:          new Date(dto.date),
        reason:        dto.reason,
        clinicName:    dto.clinicName,
        clinicAddress: dto.clinicAddress,
        clinicLat:     dto.clinicLat,
        clinicLon:     dto.clinicLon,
        anamnesisId:   dto.anamnesisId,
      },
      include: { patient: { select: { id: true, name: true, ownerId: true } } },
    });
  }

  async update(id: number, dto: UpdateAppointmentDto) {
    await this.resolveAppointment(id);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.status !== undefined && { status: dto.status as AppointmentStatus }),
      },
      include: { patient: { select: { id: true, name: true, ownerId: true } } },
    });
  }

  async remove(id: number) {
    await this.resolveAppointment(id);
    return this.prisma.appointment.delete({ where: { id } });
  }
}
