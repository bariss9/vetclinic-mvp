import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-records.dto';

const PATIENT_SELECT = { id: true, name: true, ownerId: true } as const;

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolvePatient(patientId: number) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException(`Patient #${patientId} not found`);
    return patient;
  }

  private async resolveRecord(id: number) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: { patient: { select: PATIENT_SELECT } },
    });
    if (!record) throw new NotFoundException(`Medical record #${id} not found`);
    return record;
  }

  findAll(callerId: number, callerRole: string) {
    const where = callerRole === 'CLINIC' ? {} : { patient: { ownerId: callerId } };
    return this.prisma.medicalRecord.findMany({
      where,
      include: { patient: { select: PATIENT_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByPatient(patientId: number, callerId: number, callerRole: string) {
    const where =
      callerRole === 'CLINIC'
        ? { patientId }
        : { patientId, patient: { ownerId: callerId } };
    return this.prisma.medicalRecord.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: number, callerId: number, callerRole: string) {
    const record = await this.resolveRecord(id);
    if (callerRole === 'OWNER' && record.patient.ownerId !== callerId) {
      throw new ForbiddenException('Bu kayda erişim yetkiniz yok');
    }
    return record;
  }

  async create(dto: CreateMedicalRecordDto, callerId: number, callerRole: string) {
    const patient = await this.resolvePatient(dto.patientId);
    if (callerRole === 'OWNER' && patient.ownerId !== callerId) {
      throw new ForbiddenException('Bu hastaya kayıt ekleyemezsiniz');
    }
    return this.prisma.medicalRecord.create({
      data: {
        patientId: dto.patientId,
        symptoms: dto.symptoms,
        notes: dto.notes,
        aiResult: dto.aiResult as Prisma.InputJsonValue ?? undefined,
      },
      include: { patient: { select: PATIENT_SELECT } },
    });
  }

  async update(id: number, dto: UpdateMedicalRecordDto, callerId: number, callerRole: string) {
    await this.findOne(id, callerId, callerRole);
    return this.prisma.medicalRecord.update({
      where: { id },
      data: {
        ...(dto.symptoms !== undefined && { symptoms: dto.symptoms }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.aiResult !== undefined && { aiResult: dto.aiResult as Prisma.InputJsonValue }),
      },
      include: { patient: { select: PATIENT_SELECT } },
    });
  }

  async remove(id: number, callerId: number, callerRole: string) {
    await this.findOne(id, callerId, callerRole);
    return this.prisma.medicalRecord.delete({ where: { id } });
  }
}
