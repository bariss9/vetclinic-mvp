import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto, LoginDto, VerifyEmailDto, ResendVerificationDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  // verify-email brute force sayacı: email başına max 5 başarısız deneme / 10 dk
  private readonly verifyAttempts = new Map<string, { count: number; resetAt: number }>();
  private static readonly MAX_VERIFY_ATTEMPTS = 5;
  private static readonly VERIFY_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

  private generateCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  private assertVerifyAttemptsAllowed(email: string) {
    const entry = this.verifyAttempts.get(email);
    if (!entry) return;
    if (entry.resetAt <= Date.now()) {
      this.verifyAttempts.delete(email);
      return;
    }
    if (entry.count >= UsersService.MAX_VERIFY_ATTEMPTS) {
      throw new HttpException(
        'Çok fazla hatalı deneme — lütfen daha sonra tekrar deneyin',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordVerifyFailure(email: string) {
    const now = Date.now();
    const entry = this.verifyAttempts.get(email);
    if (entry && entry.resetAt > now) {
      entry.count += 1;
    } else {
      this.verifyAttempts.set(email, { count: 1, resetAt: now + UsersService.VERIFY_ATTEMPT_WINDOW_MS });
    }
  }

  private verificationEmail(code: string): string {
    return `<p>VetClinic doğrulama kodunuz: <strong style="font-size:1.4em">${code}</strong></p><p>Bu kod 2 dakika geçerlidir.</p>`;
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // User enumeration önlemi: doğrulanmış hesap için de aynı mesaj döner, mail gitmez
    if (existing?.isVerified) {
      return { message: 'Doğrulama kodu e-posta adresinize gönderildi' };
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    if (existing) {
      // Doğrulanmamış hesabın şifre/isim bilgileri ÜZERİNE YAZILMAZ (hesap gaspı önlemi) —
      // sadece yeni doğrulama kodu üretilir
      await this.prisma.user.update({
        where: { email: dto.email },
        data: {
          verificationCode: code,
          verificationCodeExpiresAt: expiresAt,
        },
      });
    } else {
      const hashed = await bcrypt.hash(dto.password, 10);
      const role = dto.role ?? 'OWNER';
      await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashed,
          name: dto.name,
          role,
          isVerified: false,
          verificationCode: code,
          verificationCodeExpiresAt: expiresAt,
          ...(role === 'CLINIC' && dto.clinicName
            ? { clinic: { create: { name: dto.clinicName } } }
            : {}),
        },
      });
    }

    const ok = await this.mail.sendMail(dto.email, 'VetClinic — E-posta Doğrulama', this.verificationEmail(code));
    if (!ok) throw new ServiceUnavailableException('Doğrulama kodu gönderilemedi, lütfen tekrar deneyin');

    return { message: 'Doğrulama kodu e-posta adresinize gönderildi' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const attemptKey = dto.email.toLowerCase();
    this.assertVerifyAttemptsAllowed(attemptKey);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.verificationCode !== dto.code) {
      this.recordVerifyFailure(attemptKey);
      throw new BadRequestException('Geçersiz doğrulama kodu');
    }

    if (!user.verificationCodeExpiresAt || user.verificationCodeExpiresAt < new Date()) {
      this.recordVerifyFailure(attemptKey);
      throw new BadRequestException('Doğrulama kodunun süresi dolmuş');
    }

    this.verifyAttempts.delete(attemptKey);

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { isVerified: true, verificationCode: null, verificationCodeExpiresAt: null },
    });

    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { access_token: token };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Don't leak whether the email exists
    if (!user || user.isVerified) {
      return { message: 'Doğrulama kodu e-posta adresinize gönderildi' };
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { verificationCode: code, verificationCodeExpiresAt: expiresAt },
    });

    const ok = await this.mail.sendMail(dto.email, 'VetClinic — E-posta Doğrulama', this.verificationEmail(code));
    if (!ok) throw new ServiceUnavailableException('Doğrulama kodu gönderilemedi, lütfen tekrar deneyin');

    return { message: 'Doğrulama kodu e-posta adresinize gönderildi' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isVerified) {
      throw new ForbiddenException('Hesap doğrulanmamış');
    }

    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { access_token: token };
  }
}
