import {
  BadRequestException,
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
  pdpId: null,
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

  it('defaults to active users sorted by createdAt with default pagination', async () => {
    const result = await service.findAll({}, Role.SUPER);
    expect(findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({ where: { active: true } });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          username: 'ada',
          active: true,
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
      skip: 0,
      take: 100,
    });
    expect(result.data[0].username).toBe('ada');
    expect(result.data[0].active).toBe(true);
  });

  it('filters by role, manager, and active together', async () => {
    await service.findAll(
      { role: Role.USER, managerId: 'manager-1', active: true },
      Role.SUPER,
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER, managerId: 'manager-1', active: true },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({
      where: { role: Role.USER, managerId: 'manager-1', active: true },
    });
  });

  it('applies page and pageSize after filters', async () => {
    count.mockResolvedValue(250);
    const result = await service.findAll(
      {
        role: Role.USER,
        page: 2,
        pageSize: 50,
      },
      Role.SUPER,
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER, active: true },
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
    await service.findAll(
      {
        role: Role.USER,
        managerId: 'manager-1',
        pdpId: 'pdp-1',
      },
      Role.SUPER,
    );
    expect(findMany).toHaveBeenCalledWith({
      where: {
        role: Role.USER,
        managerId: 'manager-1',
        pdpId: 'pdp-1',
        active: true,
      },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        role: Role.USER,
        managerId: 'manager-1',
        pdpId: 'pdp-1',
        active: true,
      },
    });
  });

  it('returns users with an empty pdpId when hasPdp is false', async () => {
    await service.findAll({ role: Role.USER, hasPdp: false }, Role.SUPER);
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.USER, pdpId: null, active: true },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
  });

  it('rejects pdpId together with hasPdp false', async () => {
    await expect(
      service.findAll({ pdpId: 'pdp-1', hasPdp: false }, Role.SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('allows SUPER to list inactive users', async () => {
    findMany.mockResolvedValue([inactiveUser]);
    await service.findAll({ active: false }, Role.SUPER);
    expect(findMany).toHaveBeenCalledWith({
      where: { active: false },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({ where: { active: false } });
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
    findUnique.mockResolvedValue({ ...user, managerId: 'manager-1' });
    update.mockResolvedValue({ ...user, active: false });
  });

  it('allows SUPER to deactivate a user', async () => {
    const result = await service.update(user.id, { active: false }, Role.SUPER);
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
      service.update('user-1', { managerId: 'manager-2' }, Role.SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('connects a PDP on update and returns pdpId', async () => {
    update.mockImplementation(async () => ({
      ...subject,
      pdpId: 'pdp-1',
    }));

    const updated = await service.update(
      'user-1',
      { pdpId: 'pdp-1' },
      Role.SUPER,
    );

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

    const updated = await service.update('user-1', { pdpId: null }, Role.SUPER);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        pdp: { disconnect: true },
      }),
    });
    expect(updated.pdpId).toBeNull();
  });
});

describe('UsersService.deactivate', () => {
  const findUnique = vi.fn();
  const findMany = vi.fn();
  const count = vi.fn();
  const updateMany = vi.fn();
  const update = vi.fn();
  const service = new UsersService({
    user: { findUnique, findMany, count, updateMany, update },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ user: { updateMany, update } }),
  } as unknown as PrismaService);

  const people = [
    { ...user, id: 'mgr', username: 'mgr', role: Role.MANAGER },
    {
      ...user,
      id: 'report',
      username: 'report',
      role: Role.USER,
      managerId: 'mgr',
    },
    {
      ...user,
      id: 'nested',
      username: 'nested',
      role: Role.USER,
      managerId: 'report',
    },
    {
      ...user,
      id: 'child-mgr',
      username: 'child-mgr',
      role: Role.MANAGER,
      managerId: 'mgr',
    },
    {
      ...user,
      id: 'deep-mgr',
      username: 'deep-mgr',
      role: Role.MANAGER,
      managerId: 'report',
    },
    { ...user, id: 'other', username: 'other', role: Role.MANAGER },
    {
      ...user,
      id: 'inactive-mgr',
      username: 'inactive-mgr',
      role: Role.MANAGER,
      active: false,
    },
    {
      ...user,
      id: 'pdp',
      username: 'pdp',
      role: Role.PDP,
      managerId: 'other',
    },
    {
      ...user,
      id: 'assignee',
      username: 'assignee',
      role: Role.USER,
      managerId: 'other',
      pdpId: 'pdp',
    },
    {
      ...user,
      id: 'other-pdp',
      username: 'other-pdp',
      role: Role.PDP,
      managerId: 'other',
    },
    {
      ...user,
      id: 'wrong-pdp',
      username: 'wrong-pdp',
      role: Role.PDP,
      managerId: 'mgr',
    },
    {
      ...user,
      id: 'solo-pdp',
      username: 'solo-pdp',
      role: Role.PDP,
      managerId: 'other',
    },
    {
      ...user,
      id: 'plain',
      username: 'plain',
      role: Role.USER,
      managerId: 'other',
    },
    { ...user, id: 'solo-mgr', username: 'solo-mgr', role: Role.MANAGER },
    {
      ...user,
      id: 'gone',
      username: 'gone',
      role: Role.USER,
      active: false,
      managerId: 'other',
    },
  ];

  beforeEach(() => {
    findUnique.mockReset();
    findMany.mockReset();
    count.mockReset();
    updateMany.mockReset();
    update.mockReset();
    findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        return people.find((person) => person.id === where.id) ?? null;
      },
    );
    findMany.mockImplementation(
      async ({ where }: { where?: { managerId?: string; pdpId?: string } }) => {
        return people.filter((person) => {
          if (where?.managerId) return person.managerId === where.managerId;
          if (where?.pdpId) return person.pdpId === where.pdpId;
          return true;
        });
      },
    );
    count.mockImplementation(
      async ({ where }: { where: { managerId?: string; pdpId?: string } }) =>
        people.filter((person) => {
          if (where.managerId) return person.managerId === where.managerId;
          if (where.pdpId) return person.pdpId === where.pdpId;
          return false;
        }).length,
    );
    updateMany.mockResolvedValue({ count: 1 });
    update.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      ...people.find((person) => person.id === where.id),
      active: false,
    }));
  });

  it('deactivates a user when no transfer is required', async () => {
    const result = await service.deactivate('plain', {}, Role.SUPER);
    expect(updateMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'plain' },
      data: { active: false },
    });
    expect(result.active).toBe(false);
  });

  it('moves only direct reports to an outside manager', async () => {
    await service.deactivate(
      'mgr',
      { replacementManagerId: 'other' },
      Role.MANAGER,
    );
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { managerId: 'mgr' },
      data: { managerId: 'other' },
    });
  });

  it('rejects a manager deactivation that omits the replacement', async () => {
    await expect(
      service.deactivate('mgr', {}, Role.SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a replacement inside the closed tree', async () => {
    await expect(
      service.deactivate(
        'mgr',
        { replacementManagerId: 'child-mgr' },
        Role.SUPER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.deactivate(
        'mgr',
        { replacementManagerId: 'deep-mgr' },
        Role.SUPER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a replacement that is not an active manager', async () => {
    await expect(
      service.deactivate(
        'mgr',
        { replacementManagerId: 'inactive-mgr' },
        Role.SUPER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears pdpId when replacementPdpId is null', async () => {
    await service.deactivate('pdp', { replacementPdpId: null }, Role.SUPER);
    expect(updateMany).toHaveBeenCalledWith({
      where: { pdpId: 'pdp' },
      data: { pdpId: null },
    });
  });

  it('moves assigned users to another PDP with the same manager', async () => {
    await service.deactivate(
      'pdp',
      { replacementPdpId: 'other-pdp' },
      Role.MANAGER,
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { pdpId: 'pdp' },
      data: { pdpId: 'other-pdp' },
    });
  });

  it('rejects a replacement PDP whose manager does not match', async () => {
    await expect(
      service.deactivate('pdp', { replacementPdpId: 'wrong-pdp' }, Role.SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a PDP deactivation that omits the replacement choice', async () => {
    await expect(
      service.deactivate('pdp', {}, Role.SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not require a replacement for a PDP with no assigned users', async () => {
    await service.deactivate('solo-pdp', {}, Role.SUPER);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('forbids USER from deactivating', async () => {
    await expect(
      service.deactivate('plain', {}, Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects deactivating a user who is already inactive', async () => {
    await expect(
      service.deactivate('gone', {}, Role.SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects patching active to false when a transfer is required', async () => {
    await expect(
      service.update('mgr', { active: false }, Role.SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
