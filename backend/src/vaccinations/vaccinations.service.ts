import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { VaccinationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVaccinationDto, UpdateVaccinationDto } from './vaccinations.dto';

const CLINIC_SELECT = { id: true, name: true } as const;
const PATIENT_SELECT = { id: true, name: true, species: true, breed: true, age: true } as const;

@Injectable()
export class VaccinationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveClinic(userId: number) {
    const clinic = await this.prisma.clinic.findUnique({ where: { userId } });
    if (!clinic) throw new ForbiddenException('Klinik hesabı bulunamadı');
    return clinic;
  }

  private async resolveRecord(id: number) {
    const record = await this.prisma.vaccinationRecord.findUnique({
      where: { id },
      include: { createdByClinic: { select: CLINIC_SELECT } },
    });
    if (!record) throw new NotFoundException(`VaccinationRecord #${id} not found`);
    return record;
  }

  async findAll(patientId: number | undefined, callerId: number, callerRole: string) {
    if (patientId === undefined) {
      // CLINIC tüm kayıtları çekebilir (takvim görünümü); OWNER için patientId zorunlu
      if (callerRole !== 'CLINIC') throw new BadRequestException('patientId zorunludur');
      return this.prisma.vaccinationRecord.findMany({
        include: {
          createdByClinic: { select: CLINIC_SELECT },
          patient:         { select: PATIENT_SELECT },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException(`Patient #${patientId} not found`);
    if (callerRole === 'OWNER' && patient.ownerId !== callerId) {
      throw new ForbiddenException('Bu hastanın aşı kayıtlarına erişim yetkiniz yok');
    }
    return this.prisma.vaccinationRecord.findMany({
      where: { patientId },
      include: { createdByClinic: { select: CLINIC_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateVaccinationDto, callerId: number, callerRole: string) {
    if (callerRole !== 'CLINIC') throw new ForbiddenException('Sadece klinikler aşı kaydı ekleyebilir');
    const clinic = await this.resolveClinic(callerId);
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException(`Patient #${dto.patientId} not found`);
    return this.prisma.vaccinationRecord.create({
      data: {
        patientId:        dto.patientId,
        vaccineName:      dto.vaccineName,
        administeredDate: dto.administeredDate ? new Date(dto.administeredDate) : null,
        nextDueDate:      dto.nextDueDate      ? new Date(dto.nextDueDate)      : null,
        status:           (dto.status ?? 'PLANNED') as VaccinationStatus,
        notes:            dto.notes,
        createdByClinicId: clinic.id,
      },
      include: { createdByClinic: { select: CLINIC_SELECT } },
    });
  }

  async update(id: number, dto: UpdateVaccinationDto, callerId: number, callerRole: string) {
    if (callerRole !== 'CLINIC') throw new ForbiddenException('Sadece klinikler aşı kaydı güncelleyebilir');
    const clinic = await this.resolveClinic(callerId);
    const record = await this.resolveRecord(id);
    if (record.createdByClinicId !== clinic.id) {
      throw new ForbiddenException('Bu kaydı yalnızca oluşturan klinik güncelleyebilir');
    }
    return this.prisma.vaccinationRecord.update({
      where: { id },
      data: {
        ...(dto.vaccineName      !== undefined && { vaccineName:      dto.vaccineName }),
        ...(dto.administeredDate !== undefined && { administeredDate: dto.administeredDate ? new Date(dto.administeredDate) : null }),
        ...(dto.nextDueDate      !== undefined && { nextDueDate:      dto.nextDueDate ? new Date(dto.nextDueDate) : null }),
        ...(dto.status           !== undefined && { status:           dto.status as VaccinationStatus }),
        ...(dto.notes            !== undefined && { notes:            dto.notes }),
      },
      include: { createdByClinic: { select: CLINIC_SELECT } },
    });
  }

  async remove(id: number, callerId: number, callerRole: string) {
    if (callerRole !== 'CLINIC') throw new ForbiddenException('Sadece klinikler aşı kaydı silebilir');
    const clinic = await this.resolveClinic(callerId);
    const record = await this.resolveRecord(id);
    if (record.createdByClinicId !== clinic.id) {
      throw new ForbiddenException('Bu kaydı yalnızca oluşturan klinik silebilir');
    }
    return this.prisma.vaccinationRecord.delete({ where: { id } });
  }
}
