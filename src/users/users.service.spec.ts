import { BadRequestException } from '@nestjs/common';
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
  pdpId: null,
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
    expect(result.data[0].pdpId).toBeNull();
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

  it('filters by pdpId together with role and managerId', async () => {
    await service.findAll({
      role: Role.USER,
      managerId: 'manager-1',
      pdpId: 'pdp-1',
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER, managerId: 'manager-1', pdpId: 'pdp-1' },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({
      where: { role: Role.USER, managerId: 'manager-1', pdpId: 'pdp-1' },
    });
  });

  it('returns users with an empty pdpId when hasPdp is false', async () => {
    await service.findAll({ role: Role.USER, hasPdp: false });
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER, pdpId: null },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
  });

  it('rejects pdpId together with hasPdp false', async () => {
    await expect(
      service.findAll({ pdpId: 'pdp-1', hasPdp: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('UsersService PDP assignment', () => {
  const findUnique = vi.fn();
  const findFirst = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const service = new UsersService({
    user: { findUnique, findFirst, create, update },
  } as unknown as PrismaService);

  const manager = {
    ...user,
    id: 'manager-1',
    role: Role.MANAGER,
    managerId: null,
    pdpId: null,
  };
  const pdp = {
    ...user,
    id: 'pdp-1',
    username: 'pdp',
    role: Role.PDP,
    managerId: 'manager-1',
    pdpId: null,
  };
  const subject = {
    ...user,
    id: 'user-1',
    role: Role.USER,
    managerId: 'manager-1',
    pdpId: null,
  };

  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    create.mockReset();
    update.mockReset();
    findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.username) return null;
        if (where.id === manager.id) return manager;
        if (where.id === pdp.id) return pdp;
        if (where.id === subject.id) return subject;
        return null;
      },
    );
    create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...subject,
        ...data,
        id: 'user-2',
      }),
    );
    update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...subject,
        ...data,
        managerId: subject.managerId,
        pdpId: subject.pdpId,
      }),
    );
  });

  it('creates a user with a PDP who shares their manager', async () => {
    const created = await service.create({
      username: 'ada',
      password: 'secret',
      name: 'Ada',
      role: Role.USER,
      managerId: 'manager-1',
      pdpId: 'pdp-1',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: Role.USER,
        managerId: 'manager-1',
        pdpId: 'pdp-1',
      }),
    });
    expect(created.pdpId).toBe('pdp-1');
    expect(created).not.toHaveProperty('passwordHash');
  });

  it('rejects a USER without a manager', async () => {
    await expect(
      service.create({
        username: 'ada',
        password: 'secret',
        name: 'Ada',
        role: Role.USER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a PDP without a manager', async () => {
    await expect(
      service.create({
        username: 'ada',
        password: 'secret',
        name: 'Ada',
        role: Role.PDP,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a PDP that is assigned a pdpId', async () => {
    await expect(
      service.create({
        username: 'ada',
        password: 'secret',
        name: 'Ada',
        role: Role.PDP,
        managerId: 'manager-1',
        pdpId: 'pdp-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a MANAGER that is assigned a pdpId', async () => {
    await expect(
      service.create({
        username: 'ada',
        password: 'secret',
        name: 'Ada',
        role: Role.MANAGER,
        pdpId: 'pdp-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a pdpId that is missing, not a PDP, or has another manager', async () => {
    await expect(
      service.create({
        username: 'ada',
        password: 'secret',
        name: 'Ada',
        role: Role.USER,
        managerId: 'manager-1',
        pdpId: 'missing',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.username) return null;
        if (where.id === manager.id) return manager;
        if (where.id === 'other-user') {
          return {
            ...user,
            id: 'other-user',
            role: Role.USER,
            managerId: 'manager-1',
          };
        }
        return null;
      },
    );
    await expect(
      service.create({
        username: 'ada',
        password: 'secret',
        name: 'Ada',
        role: Role.USER,
        managerId: 'manager-1',
        pdpId: 'other-user',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.username) return null;
        if (where.id === manager.id) return manager;
        if (where.id === pdp.id) return { ...pdp, managerId: 'other-manager' };
        return null;
      },
    );
    await expect(
      service.create({
        username: 'ada',
        password: 'secret',
        name: 'Ada',
        role: Role.USER,
        managerId: 'manager-1',
        pdpId: 'pdp-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an update that leaves a USER PDP under a different manager', async () => {
    findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.id === subject.id) {
          return { ...subject, pdpId: 'pdp-1' };
        }
        if (where.id === 'manager-2') {
          return { ...manager, id: 'manager-2' };
        }
        if (where.id === pdp.id) return pdp;
        return null;
      },
    );

    await expect(
      service.update('user-1', { managerId: 'manager-2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('connects a PDP on update and returns pdpId', async () => {
    update.mockImplementation(async () => ({
      ...subject,
      pdpId: 'pdp-1',
    }));

    const updated = await service.update('user-1', { pdpId: 'pdp-1' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        pdp: { connect: { id: 'pdp-1' } },
      }),
    });
    expect(updated.pdpId).toBe('pdp-1');
  });

  it('clears pdpId when the update sends an empty value', async () => {
    findUnique.mockImplementation(
      async ({ where }: { where: { id?: string } }) => {
        if (where.id === subject.id) return { ...subject, pdpId: 'pdp-1' };
        if (where.id === manager.id) return manager;
        if (where.id === pdp.id) return pdp;
        return null;
      },
    );
    update.mockImplementation(async () => ({
      ...subject,
      pdpId: null,
    }));

    const updated = await service.update('user-1', { pdpId: null });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        pdp: { disconnect: true },
      }),
    });
    expect(updated.pdpId).toBeNull();
  });
});
