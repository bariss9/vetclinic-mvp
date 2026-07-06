import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { Request } from 'express';

export interface JwtPayload {
  sub: number;
  email: string;
  role: 'OWNER' | 'CLINIC';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token');
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new InternalServerErrorException('JWT_SECRET is not configured');
    try {
      const payload = jwt.verify(auth.slice(7), secret) as unknown as JwtPayload;
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
