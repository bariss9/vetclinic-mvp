import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly appointments: AppointmentsService,
  ) {}

  // Her gün saat 09:00'da çalışır
  @Cron('0 9 * * *')
  async sendDailyReminders() {
    await this.runReminders();
  }

  // Her gün saat 08:00 — tarihi 2+ gün geçmiş ve hâlâ SCHEDULED kalan randevuları
  // UNCERTAIN'e çeker. reminderSent'ten bağımsız, ayrı bir otomatik geçiştir.
  @Cron('0 8 * * *')
  async markStaleAppointments(): Promise<number> {
    const now = new Date();
    // dünün 00:00'ından önceki randevular = tarihi en az 2 gün geçmiş
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const result = await this.prisma.appointment.updateMany({
      where: { status: 'SCHEDULED', date: { lt: cutoff } },
      data:  { status: 'UNCERTAIN' },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} randevu UNCERTAIN'e çekildi (tarihi 2+ gün geçmiş, hâlâ SCHEDULED)`);
    }
    return result.count;
  }

  // Her 30 dakikada — hâlâ PENDING (onay bekleyen) randevular için kliniğe hatırlatma.
  // Spam önleme: randevu başına max 3 deneme (reminderCount). Sayaç mail başarısız olsa da
  // artar — Resend test modunda doğrulanmamış adreslere gönderim KALICI olarak başarısızdır,
  // sayaç artmasa cron aynı randevu için süresiz yeniden denerdi.
  @Cron('*/30 * * * *')
  async remindPendingAppointments(): Promise<{ sent: number; failed: number }> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status:        'PENDING',
        reminderCount: { lt: 3 },
        date:          { gte: new Date() }, // tarihi geçmiş talep için hatırlatma anlamsız
      },
      include: {
        patient: {
          include: { owner: { select: { name: true } } },
        },
      },
    });

    if (appointments.length === 0) return { sent: 0, failed: 0 };
    this.logger.log(`PENDING hatırlatma işi başladı — ${appointments.length} randevu bulundu`);

    let sent = 0;
    let failed = 0;

    for (const appt of appointments) {
      try {
        const clinicEmail = await this.appointments.resolveClinicEmail(appt.clinicName);

        if (clinicEmail) {
          const apptDate = new Date(appt.date);
          const dateStr = apptDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
          const timeStr = apptDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          const ownerName = appt.patient.owner.name ?? 'Belirtilmemiş';

          const html = `
            <div style="font-family:sans-serif;max-width:520px;margin:auto">
              <h2 style="color:#d97706">VetClinic — Onay Bekleyen Randevu</h2>
              <p><strong>${appt.patient.name}</strong> için randevu talebi hâlâ onay bekliyor (hatırlatma ${appt.reminderCount + 1}/3).</p>
              <table style="border-collapse:collapse;width:100%;margin:1rem 0">
                <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Hasta Sahibi</td>
                    <td style="padding:6px 12px">${ownerName}</td></tr>
                <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Hayvan</td>
                    <td style="padding:6px 12px">${appt.patient.name}</td></tr>
                <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Tarih</td>
                    <td style="padding:6px 12px">${dateStr}</td></tr>
                <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Saat</td>
                    <td style="padding:6px 12px">${timeStr}</td></tr>
              </table>
              <p>Randevuları yönetmek için giriş yapın: <a href="http://localhost:5173">http://localhost:5173</a></p>
              <p style="color:#64748b;font-size:0.85rem">Bu mesaj VetClinic AI tarafından otomatik gönderilmiştir.</p>
            </div>`;

          const ok = await this.mail.sendMail(clinicEmail, `VetClinic — Onay Bekleyen Randevu (${appt.patient.name})`, html);
          if (ok) {
            this.logger.log(`PENDING hatırlatma gönderildi: appt#${appt.id} → ${clinicEmail} (${appt.reminderCount + 1}/3)`);
            sent++;
          } else {
            this.logger.warn(`PENDING hatırlatma gönderilemedi: appt#${appt.id} → ${clinicEmail} (deneme ${appt.reminderCount + 1}/3)`);
            failed++;
          }
        } else {
          this.logger.warn(`PENDING hatırlatma atlandı — "${appt.clinicName ?? '(klinik yok)'}" için CLINIC hesabı bulunamadı (appt#${appt.id}, deneme ${appt.reminderCount + 1}/3)`);
          failed++;
        }

        // Deneme sayacı her durumda artar (bkz. metod üstü yorum)
        await this.prisma.appointment.update({
          where: { id: appt.id },
          data:  { reminderCount: { increment: 1 } },
        });
      } catch (err) {
        this.logger.error(`PENDING hatırlatma başarısız: appt#${appt.id} — ${(err as Error).message}`);
        failed++;
      }
    }

    this.logger.log(`PENDING hatırlatma işi bitti — gönderildi: ${sent}, başarısız/atlanan: ${failed}`);
    return { sent, failed };
  }

  async runReminders(): Promise<{ sent: number; failed: number }> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0);
    const end   = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        date:         { gte: start, lte: end },
        status:       'SCHEDULED',
        reminderSent: false,
      },
      include: {
        patient: {
          include: { owner: { select: { email: true, name: true } } },
        },
      },
    });

    this.logger.log(`Hatırlatma işi başladı — ${appointments.length} randevu bulundu`);

    let sent = 0;
    let failed = 0;

    for (const appt of appointments) {
      try {
        const ownerEmail = appt.patient.owner.email;
        const ownerName  = appt.patient.owner.name ?? 'Sayın Hasta Sahibi';
        const patientName = appt.patient.name;
        const apptDate = new Date(appt.date);

        const dateStr = apptDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
        const timeStr = apptDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const clinic  = appt.clinicName ?? 'Belirtilmemiş';

        const html = `
          <div style="font-family:sans-serif;max-width:520px;margin:auto">
            <h2 style="color:#2563eb">VetClinic — Randevu Hatırlatması</h2>
            <p>Merhaba ${ownerName},</p>
            <p><strong>${patientName}</strong> için yarınki randevunuzu hatırlatmak istedik.</p>
            <table style="border-collapse:collapse;width:100%;margin:1rem 0">
              <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Tarih</td>
                  <td style="padding:6px 12px">${dateStr}</td></tr>
              <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Saat</td>
                  <td style="padding:6px 12px">${timeStr}</td></tr>
              <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Klinik</td>
                  <td style="padding:6px 12px">${clinic}</td></tr>
              <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600">Hayvan</td>
                  <td style="padding:6px 12px">${patientName}</td></tr>
            </table>
            <p style="color:#64748b;font-size:0.85rem">Bu mesaj VetClinic AI tarafından otomatik gönderilmiştir.</p>
          </div>`;

        const ok = await this.mail.sendMail(ownerEmail, `VetClinic — Yarınki Randevunuz (${patientName})`, html);

        if (ok) {
          await this.prisma.appointment.update({
            where: { id: appt.id },
            data:  { reminderSent: true },
          });
          this.logger.log(`Hatırlatma gönderildi: appt#${appt.id} → ${ownerEmail}`);
          sent++;
        } else {
          this.logger.warn(`Hatırlatma gönderilemedi, reminderSent=false kaldı: appt#${appt.id} → ${ownerEmail}`);
          failed++;
        }
      } catch (err) {
        this.logger.error(`Hatırlatma başarısız: appt#${appt.id} — ${(err as Error).message}`);
        failed++;
      }
    }

    this.logger.log(`Hatırlatma işi bitti — gönderildi: ${sent}, başarısız: ${failed}`);
    return { sent, failed };
  }
}
