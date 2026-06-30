import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: 'VetClinic <onboarding@resend.dev>',
      to,
      subject,
      html,
    });
    if (error) {
      this.logger.error(`Mail gönderilemedi: ${to} — ${error.message}`);
    }
  }
}
