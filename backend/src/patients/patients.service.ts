import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto, UpdatePatientDto } from './patients.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.patient.findMany({
      include: { owner: { select: { id: true, email: true } } },
    });
  }

  async findOne(id: number) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true } },
        medicalRecords: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!patient) throw new NotFoundException(`Patient #${id} not found`);
    return patient;
  }

  create(dto: CreatePatientDto) {
    return this.prisma.patient.create({
      data: dto,
      include: { owner: { select: { id: true, email: true } } },
    });
  }

  async update(id: number, dto: UpdatePatientDto) {
    await this.findOne(id);
    return this.prisma.patient.update({
      where: { id },
      data: dto,
      include: { owner: { select: { id: true, email: true } } },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.patient.delete({ where: { id } });
  }
}
