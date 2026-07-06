import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { RegisterDto, LoginDto, VerifyEmailDto, ResendVerificationDto } from './users.dto';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.usersService.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.usersService.login(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 120_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.usersService.verifyEmail(dto);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.usersService.resendVerification(dto);
  }
}
