import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto, UpdatePatientDto } from './patients.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(callerId: number, callerRole: string) {
    const where = callerRole === 'CLINIC' ? {} : { ownerId: callerId };
    return this.prisma.patient.findMany({
      where,
      include: { owner: { select: { id: true, email: true } } },
    });
  }

  async findOne(id: number, callerId: number, callerRole: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true } },
        medicalRecords: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!patient) throw new NotFoundException(`Patient #${id} not found`);
    if (callerRole === 'OWNER' && patient.ownerId !== callerId) {
      throw new ForbiddenException('Bu hastaya erişim yetkiniz yok');
    }
    return patient;
  }

  create(dto: CreatePatientDto, callerId: number, callerRole: string) {
    // OWNER kendi adına ekler (body'deki ownerId yok sayılır); CLINIC başkası adına ekleyebilir
    const ownerId = callerRole === 'OWNER' ? callerId : dto.ownerId;
    return this.prisma.patient.create({
      data: { ...dto, ownerId },
      include: { owner: { select: { id: true, email: true } } },
    });
  }

  async update(id: number, dto: UpdatePatientDto, callerId: number, callerRole: string) {
    await this.findOne(id, callerId, callerRole);
    return this.prisma.patient.update({
      where: { id },
      data: dto,
      include: { owner: { select: { id: true, email: true } } },
    });
  }

  async remove(id: number, callerId: number, callerRole: string) {
    await this.findOne(id, callerId, callerRole);
    return this.prisma.patient.delete({ where: { id } });
  }
}
