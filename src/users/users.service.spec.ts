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
  const count = vi.fn();
  const service = new UsersService({
    user: { findMany, count },
  } as unknown as PrismaService);

  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    findMany.mockResolvedValue([user]);
    count.mockResolvedValue(1);
  });

  it('sorts by createdAt ascending and uses default pagination', async () => {
    const result = await service.findAll();
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({ where: {} });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          username: 'ada',
        }),
      ],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    expect(result.data[0]).not.toHaveProperty('passwordHash');
  });

  it('sorts by the requested field and direction', async () => {
    const result = await service.findAll({
      sortBy: 'username',
      sortOrder: 'DESC',
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { username: 'desc' },
      skip: 0,
      take: 100,
    });
    expect(result.data[0].username).toBe('ada');
  });

  it('filters by role and manager together', async () => {
    await service.findAll({ role: Role.USER, managerId: 'manager-1' });
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER, managerId: 'manager-1' },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({
      where: { role: Role.USER, managerId: 'manager-1' },
    });
  });

  it('applies page and pageSize after filters', async () => {
    count.mockResolvedValue(250);
    const result = await service.findAll({
      role: Role.USER,
      page: 2,
      pageSize: 50,
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER },
      orderBy: { createdAt: 'asc' },
      skip: 50,
      take: 50,
    });
    expect(result).toEqual({
      data: [expect.objectContaining({ username: 'ada' })],
      page: 2,
      pageSize: 50,
      total: 250,
    });
  });
});
