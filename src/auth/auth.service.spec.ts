import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const activeUser = {
  id: 'user-1',
  username: 'ada',
  passwordHash: await bcrypt.hash('secret', 10),
  name: 'Ada',
  email: null,
  phone: null,
  address: null,
  role: Role.USER,
  active: true,
  mustChangePassword: false,
  managerId: null,
  pdpId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AuthService.login', () => {
  const findByUsername = vi.fn();
  const findById = vi.fn();
  const signAsync = vi.fn();
  const getOrThrow = vi.fn((key: string) => key);
  const get = vi.fn((_key: string, fallback: string) => fallback);

  const service = new AuthService(
    { findByUsername, findById } as unknown as UsersService,
    { signAsync } as unknown as JwtService,
    { getOrThrow, get } as unknown as ConfigService,
  );

  beforeEach(() => {
    findByUsername.mockReset();
    findById.mockReset();
    signAsync.mockReset();
    signAsync.mockResolvedValue('token');
  });

  it('rejects an inactive user without issuing tokens', async () => {
    findByUsername.mockResolvedValue({ ...activeUser, active: false });

    await expect(
      service.login({ username: 'ada', password: 'secret' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(signAsync).not.toHaveBeenCalled();
  });

  it('issues tokens for an active user', async () => {
    findByUsername.mockResolvedValue(activeUser);

    const result = await service.login({
      username: 'ada',
      password: 'secret',
    });

    expect(result.accessToken).toBe('token');
    expect(result.refreshToken).toBe('token');
    expect(result.user.active).toBe(true);
    expect(result.user.mustChangePassword).toBe(false);
    expect(result.user).not.toHaveProperty('temporaryPassword');
    expect(signAsync).toHaveBeenCalledTimes(2);
  });

  it('includes mustChangePassword when the user still has a temporary password', async () => {
    findByUsername.mockResolvedValue({
      ...activeUser,
      mustChangePassword: true,
    });

    const result = await service.login({
      username: 'ada',
      password: 'secret',
    });

    expect(result.user.mustChangePassword).toBe(true);
    expect(result.accessToken).toBe('token');
  });
});
