import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './medical-records.dto';

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
      include: { patient: { select: { id: true, name: true, ownerId: true } } },
    });
    if (!record) throw new NotFoundException(`Medical record #${id} not found`);
    return record;
  }

  findAll() {
    return this.prisma.medicalRecord.findMany({
      include: { patient: { select: { id: true, name: true, ownerId: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByPatient(patientId: number) {
    return this.prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.resolveRecord(id);
  }

  async create(dto: CreateMedicalRecordDto) {
    await this.resolvePatient(dto.patientId);
    return this.prisma.medicalRecord.create({
      data: {
        patientId: dto.patientId,
        symptoms: dto.symptoms,
        notes: dto.notes,
        aiResult: dto.aiResult as Prisma.InputJsonValue ?? undefined,
      },
      include: { patient: { select: { id: true, name: true, ownerId: true } } },
    });
  }

  async update(id: number, dto: UpdateMedicalRecordDto) {
    await this.resolveRecord(id);
    return this.prisma.medicalRecord.update({
      where: { id },
      data: {
        ...(dto.symptoms !== undefined && { symptoms: dto.symptoms }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.aiResult !== undefined && { aiResult: dto.aiResult as Prisma.InputJsonValue }),
      },
      include: { patient: { select: { id: true, name: true, ownerId: true } } },
    });
  }

  async remove(id: number) {
    await this.resolveRecord(id);
    return this.prisma.medicalRecord.delete({ where: { id } });
  }
}
