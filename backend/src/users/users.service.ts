import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private verificationEmail(code: string): string {
    return `<p>VetClinic doğrulama kodunuz: <strong style="font-size:1.4em">${code}</strong></p><p>Bu kod 15 dakika geçerlidir.</p>`;
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existing?.isVerified) {
      throw new ConflictException('Bu email zaten kayıtlı');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const role = dto.role ?? 'OWNER';
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (existing) {
      await this.prisma.user.update({
        where: { email: dto.email },
        data: {
          password: hashed,
          name: dto.name,
          verificationCode: code,
          verificationCodeExpiresAt: expiresAt,
        },
      });
    } else {
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

    await this.mail.sendMail(dto.email, 'VetClinic — E-posta Doğrulama', this.verificationEmail(code));

    return { message: 'Doğrulama kodu e-posta adresinize gönderildi' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.verificationCode !== dto.code) {
      throw new BadRequestException('Geçersiz doğrulama kodu');
    }

    if (!user.verificationCodeExpiresAt || user.verificationCodeExpiresAt < new Date()) {
      throw new BadRequestException('Doğrulama kodunun süresi dolmuş');
    }

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
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { email: dto.email },
      data: { verificationCode: code, verificationCodeExpiresAt: expiresAt },
    });

    await this.mail.sendMail(dto.email, 'VetClinic — E-posta Doğrulama', this.verificationEmail(code));

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
