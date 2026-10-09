import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

const user = {
  id: 'user-1',
  username: 'ada',
  passwordHash: 'hash',
  name: 'Ada',
  email: null,
  phone: null,
  address: null,
  role: Role.USER,
  managerId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UsersService.findAll', () => {
  const findMany = vi.fn();
  const service = new UsersService({
    user: { findMany },
  } as unknown as PrismaService);

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([user]);
  });

  it('sorts by createdAt ascending when no query is provided', async () => {
    await service.findAll();
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'asc' },
    });
  });

  it('sorts by the requested field and direction', async () => {
    const result = await service.findAll({
      sortBy: 'username',
      sortOrder: 'DESC',
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { username: 'desc' },
    });
    expect(result[0].username).toBe('ada');
    expect(result[0]).not.toHaveProperty('passwordHash');
  });

  it('filters by role and manager together', async () => {
    await service.findAll({ role: Role.USER, managerId: 'manager-1' });
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER, managerId: 'manager-1' },
      orderBy: { createdAt: 'asc' },
    });
  });
});
