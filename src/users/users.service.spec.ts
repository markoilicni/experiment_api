import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  active: true,
  managerId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const inactiveUser = {
  ...user,
  id: 'user-2',
  username: 'inactive',
  active: false,
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

  it('defaults to active users sorted by createdAt ascending', async () => {
    await service.findAll({}, Role.SUPER);
    expect(findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('sorts by the requested field and direction', async () => {
    const result = await service.findAll(
      {
        sortBy: 'username',
        sortOrder: 'DESC',
      },
      Role.MANAGER,
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { username: 'desc' },
    });
    expect(result[0].username).toBe('ada');
    expect(result[0].active).toBe(true);
    expect(result[0]).not.toHaveProperty('passwordHash');
  });

  it('filters by role, manager, and active together', async () => {
    await service.findAll(
      { role: Role.USER, managerId: 'manager-1', active: true },
      Role.SUPER,
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER, managerId: 'manager-1', active: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('allows SUPER to list inactive users', async () => {
    findMany.mockResolvedValue([inactiveUser]);
    await service.findAll({ active: false }, Role.SUPER);
    expect(findMany).toHaveBeenCalledWith({
      where: { active: false },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('forbids non-SUPER callers from listing inactive users', async () => {
    await expect(
      service.findAll({ active: false }, Role.MANAGER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('UsersService.findOne', () => {
  const findUnique = vi.fn();
  const service = new UsersService({
    user: { findUnique },
  } as unknown as PrismaService);

  beforeEach(() => {
    findUnique.mockReset();
  });

  it('returns an active user for any allowed caller', async () => {
    findUnique.mockResolvedValue(user);
    const result = await service.findOne(user.id, Role.MANAGER);
    expect(result.active).toBe(true);
  });

  it('returns an inactive user for SUPER', async () => {
    findUnique.mockResolvedValue(inactiveUser);
    const result = await service.findOne(inactiveUser.id, Role.SUPER);
    expect(result.active).toBe(false);
  });

  it('returns 404 for an inactive user when the caller is not SUPER', async () => {
    findUnique.mockResolvedValue(inactiveUser);
    await expect(
      service.findOne(inactiveUser.id, Role.MANAGER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.update active', () => {
  const findUnique = vi.fn();
  const findFirst = vi.fn();
  const update = vi.fn();
  const service = new UsersService({
    user: { findUnique, findFirst, update },
  } as unknown as PrismaService);

  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    update.mockReset();
    findUnique.mockResolvedValue(user);
    update.mockResolvedValue({ ...user, active: false });
  });

  it('allows SUPER to deactivate a user', async () => {
    const result = await service.update(
      user.id,
      { active: false },
      Role.SUPER,
    );
    expect(update).toHaveBeenCalled();
    expect(result.active).toBe(false);
  });

  it('allows SUPER to reactivate a user', async () => {
    update.mockResolvedValue({ ...user, active: true });
    await service.update(user.id, { active: true }, Role.SUPER);
    expect(update).toHaveBeenCalled();
  });

  it('forbids non-SUPER from reactivating a user', async () => {
    await expect(
      service.update(user.id, { active: true }, Role.MANAGER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('forbids PDP from changing active', async () => {
    await expect(
      service.update(user.id, { active: false }, Role.PDP),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids USER from changing active', async () => {
    await expect(
      service.update(user.id, { active: false }, Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
