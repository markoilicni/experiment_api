import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service.js';
import { toSafeUser } from '../users/users.types.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user.id, user.role, toSafeUser(user));
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(user.id, user.role, toSafeUser(user));
  }

  private async buildAuthResponse(
    userId: string,
    role: Role,
    user: ReturnType<typeof toSafeUser>,
  ) {
    const accessExpiresIn = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '1h',
    ) as StringValue;
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '1d',
    ) as StringValue;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, role, type: 'access' } satisfies JwtPayload,
        {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: accessExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, role, type: 'refresh' } satisfies JwtPayload,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      user,
    };
  }
}
