import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // Her gün saat 09:00'da çalışır
  @Cron('0 9 * * *')
  async sendDailyReminders() {
    await this.runReminders();
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
