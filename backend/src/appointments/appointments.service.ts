import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './appointments.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly patientInclude = {
    patient: {
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    },
  } as const;

  private async resolveAppointment(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: this.patientInclude,
    });
    if (!appointment) throw new NotFoundException(`Appointment #${id} not found`);
    return appointment;
  }

  private guardOwner(ownerId: number, callerId: number, callerRole: string) {
    if (callerRole === 'OWNER' && ownerId !== callerId) {
      throw new ForbiddenException('Bu randevuya erişim yetkiniz yok');
    }
  }

  // CLINIC'in yapabileceği status geçişleri; UNCERTAIN cron tarafından set edilir,
  // klinik sonradan gerçek sonuca çözümleyebilir. COMPLETED/CANCELLED/NO_SHOW son durumdur.
  private static readonly CLINIC_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
    PENDING:   ['SCHEDULED', 'CANCELLED'],
    SCHEDULED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
    UNCERTAIN: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW:   [],
  };

  private guardStatusTransition(current: AppointmentStatus, next: AppointmentStatus, callerRole: string) {
    if (next === current) return; // no-op, idempotent

    if (callerRole === 'OWNER') {
      if (next !== 'CANCELLED') {
        throw new ForbiddenException('Randevu sahibi sadece randevusunu iptal edebilir');
      }
      if (current !== 'PENDING' && current !== 'SCHEDULED') {
        throw new BadRequestException(`${current} durumundaki randevu iptal edilemez`);
      }
      return;
    }

    const allowed = AppointmentsService.CLINIC_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Geçersiz durum geçişi: ${current} → ${next}`);
    }
  }

  findAll(callerId: number, callerRole: string) {
    const where = callerRole === 'CLINIC' ? {} : { patient: { ownerId: callerId } };
    return this.prisma.appointment.findMany({
      where,
      include: this.patientInclude,
      orderBy: { date: 'asc' },
    });
  }

  findByPatient(patientId: number, callerId: number, callerRole: string) {
    const where =
      callerRole === 'CLINIC'
        ? { patientId }
        : { patientId, patient: { ownerId: callerId } };
    return this.prisma.appointment.findMany({ where, orderBy: { date: 'asc' } });
  }

  async findOne(id: number, callerId: number, callerRole: string) {
    const appt = await this.resolveAppointment(id);
    this.guardOwner(appt.patient.ownerId, callerId, callerRole);
    return appt;
  }

  async create(dto: CreateAppointmentDto, callerId: number, callerRole: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException(`Patient #${dto.patientId} not found`);
    this.guardOwner(patient.ownerId, callerId, callerRole);
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
      include: this.patientInclude,
    });
  }

  async update(id: number, dto: UpdateAppointmentDto, callerId: number, callerRole: string) {
    const appointment = await this.findOne(id, callerId, callerRole);
    if (dto.status !== undefined) {
      this.guardStatusTransition(appointment.status, dto.status as AppointmentStatus, callerRole);
    }
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.date   !== undefined && { date:   new Date(dto.date) }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.status !== undefined && { status: dto.status as AppointmentStatus }),
      },
      include: this.patientInclude,
    });
  }

  async remove(id: number, callerId: number, callerRole: string) {
    await this.findOne(id, callerId, callerRole);
    return this.prisma.appointment.delete({ where: { id } });
  }
}
