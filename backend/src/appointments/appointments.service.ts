import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './appointments.dto';

// Klinik bildirim maillerinde kullanılan asgari randevu şekli (create() include'u ile uyumlu)
export interface AppointmentForMail {
  id: number;
  date: Date;
  clinicName: string | null;
  patient: { name: string; owner: { name: string | null } };
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

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

  // Slot sistemi: her gün 09:00-17:00 arası 1'er saatlik 9 slot.
  // Saatler sunucu lokal zamanında kurulur (MVP: sunucu + istemci aynı makine/dilim).
  private static readonly SLOT_START_HOUR = 9;
  private static readonly SLOT_END_HOUR = 17; // dahil — son slot 17:00
  private static readonly BUSY_STATUSES: AppointmentStatus[] = ['PENDING', 'SCHEDULED'];

  async findAvailableSlots(clinicName: string, date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const dayStart = new Date(year, month - 1, day);
    if (isNaN(dayStart.getTime())) throw new BadRequestException('Geçersiz tarih');
    const dayEnd = new Date(year, month - 1, day + 1);

    const busy = await this.prisma.appointment.findMany({
      where: {
        clinicName,
        status: { in: AppointmentsService.BUSY_STATUSES },
        date: { gte: dayStart, lt: dayEnd },
      },
      select: { date: true },
    });
    const busyHours = new Set(busy.map(a => a.date.getHours()));

    const now = new Date();
    const slots: { time: string; iso: string }[] = [];
    for (let hour = AppointmentsService.SLOT_START_HOUR; hour <= AppointmentsService.SLOT_END_HOUR; hour++) {
      const slotDate = new Date(year, month - 1, day, hour, 0, 0, 0);
      if (slotDate <= now) continue; // geçmiş saate randevu verilmez
      if (busyHours.has(hour)) continue;
      slots.push({ time: `${String(hour).padStart(2, '0')}:00`, iso: slotDate.toISOString() });
    }
    return { clinicName, date, slots };
  }

  // clinicName → aynı isimli Clinic kaydının bağlı olduğu CLINIC kullanıcısının e-postası.
  // Overpass'tan gelen kliniklerin çoğunun sistemde hesabı yok — bulunamazsa null (mail atlanır).
  async resolveClinicEmail(clinicName: string | null): Promise<string | null> {
    if (!clinicName) return null;
    const clinic = await this.prisma.clinic.findFirst({
      where: { name: clinicName },
      include: { user: { select: { email: true } } },
    });
    return clinic?.user.email ?? null;
  }

  // Yeni randevu sonrası kliniğe anlık bildirim. Randevu oluşturmayı asla bloklamaz/geriye
  // döndürmez — mail gitmezse (Resend test modu dahil) sadece WARN loglanır.
  private async notifyClinicOfNewAppointment(appt: AppointmentForMail): Promise<void> {
    try {
      const clinicEmail = await this.resolveClinicEmail(appt.clinicName);
      if (!clinicEmail) {
        this.logger.warn(`Klinik bildirimi atlandı — "${appt.clinicName ?? '(klinik yok)'}" için CLINIC hesabı bulunamadı (appt#${appt.id})`);
        return;
      }
      const apptDate = new Date(appt.date);
      const dateStr = apptDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
      const timeStr = apptDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const ownerName = appt.patient.owner.name ?? 'Belirtilmemiş';

      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#2563eb">VetClinic — Yeni Randevu Talebi</h2>
          <p>Kliniğinize yeni bir randevu talebi geldi.</p>
          <table style="border-collapse:collapse;width:100%;margin:1rem 0">
            <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Hasta Sahibi</td>
                <td style="padding:6px 12px">${ownerName}</td></tr>
            <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Hayvan</td>
                <td style="padding:6px 12px">${appt.patient.name}</td></tr>
            <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Tarih</td>
                <td style="padding:6px 12px">${dateStr}</td></tr>
            <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Saat</td>
                <td style="padding:6px 12px">${timeStr}</td></tr>
            <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Klinik</td>
                <td style="padding:6px 12px">${appt.clinicName}</td></tr>
          </table>
          <p>Randevuları yönetmek için giriş yapın: <a href="http://localhost:5173">http://localhost:5173</a></p>
          <p style="color:#64748b;font-size:0.85rem">Bu mesaj VetClinic AI tarafından otomatik gönderilmiştir.</p>
        </div>`;

      const ok = await this.mail.sendMail(clinicEmail, `VetClinic — Yeni Randevu Talebi (${appt.patient.name})`, html);
      if (ok) {
        this.logger.log(`Klinik bildirimi gönderildi: appt#${appt.id} → ${clinicEmail}`);
      } else {
        this.logger.warn(`Klinik bildirimi gönderilemedi: appt#${appt.id} → ${clinicEmail}`);
      }
    } catch (err) {
      this.logger.warn(`Klinik bildirimi başarısız: appt#${appt.id} — ${(err as Error).message}`);
    }
  }

  // Aynı klinikte aynı saat dilimi (saat başı bucket) için aktif randevu var mı?
  private async assertSlotFree(clinicName: string, date: Date) {
    const hourStart = new Date(date);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const clash = await this.prisma.appointment.findFirst({
      where: {
        clinicName,
        status: { in: AppointmentsService.BUSY_STATUSES },
        date: { gte: hourStart, lt: hourEnd },
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException('Bu saat dolu');
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
    if (dto.clinicName) {
      await this.assertSlotFree(dto.clinicName, new Date(dto.date));
    }
    const appointment = await this.prisma.appointment.create({
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
    // fire-and-forget: mail gecikmesi/hatası randevu cevabını bekletmez
    void this.notifyClinicOfNewAppointment(appointment);
    return appointment;
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
