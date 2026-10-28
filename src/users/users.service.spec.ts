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
  mustChangePassword: false,
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

const superCaller = { id: 'super-1', role: Role.SUPER };

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
    expect(result.data[0]).not.toHaveProperty('temporaryPassword');
    expect(result.data[0].mustChangePassword).toBe(false);
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

  it('filters by the manager tree without including that manager', async () => {
    findMany.mockImplementation(async (args: { select?: { id?: boolean } }) => {
      if (args.select?.id) {
        return [
          { id: 'manager-1', managerId: null },
          { id: 'direct', managerId: 'manager-1' },
          { id: 'nested', managerId: 'direct' },
          { id: 'other', managerId: 'someone-else' },
        ];
      }
      return [user];
    });

    await service.findAll({ managerTreeId: 'manager-1' }, Role.SUPER);

    expect(findMany).toHaveBeenCalledWith({
      where: { active: true, id: { in: ['direct', 'nested'] } },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
    });
    expect(count).toHaveBeenCalledWith({
      where: { active: true, id: { in: ['direct', 'nested'] } },
    });
  });

  it('filters by name together with the manager tree and exact managerId', async () => {
    findMany.mockImplementation(async (args: { select?: { id?: boolean } }) => {
      if (args.select?.id) {
        return [
          { id: 'manager-1', managerId: null },
          { id: 'direct', managerId: 'manager-1' },
        ];
      }
      return [user];
    });

    await service.findAll(
      {
        role: Role.USER,
        managerId: 'direct',
        managerTreeId: 'manager-1',
        name: 'ada',
        pdpId: 'pdp-1',
        active: true,
      },
      Role.SUPER,
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        role: Role.USER,
        managerId: 'direct',
        id: { in: ['direct'] },
        name: { contains: 'ada' },
        pdpId: 'pdp-1',
        active: true,
      },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 100,
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

  it('lets USER and PDP list active users', async () => {
    await service.findAll({}, Role.USER);
    await service.findAll({ page: 2, pageSize: 10 }, Role.PDP);
    expect(findMany).toHaveBeenLastCalledWith({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      skip: 10,
      take: 10,
    });
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
    const result = await service.findOne(user.id, Role.USER);
    expect(result.active).toBe(true);
    const asPdp = await service.findOne(user.id, Role.PDP);
    expect(asPdp.username).toBe('ada');
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
  const findMany = vi.fn();
  const update = vi.fn();
  const service = new UsersService({
    user: { findUnique, findFirst, findMany, update },
  } as unknown as PrismaService);
  const managerCaller = { id: 'manager-1', role: Role.MANAGER };

  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    findMany.mockReset();
    update.mockReset();
    findUnique.mockResolvedValue({ ...user, managerId: 'manager-1' });
    findMany.mockResolvedValue([{ id: user.id, managerId: 'manager-1' }]);
    update.mockResolvedValue({ ...user, active: true });
  });

  it('rejects setting active to false on update', async () => {
    await expect(
      service.update(user.id, { active: false }, superCaller),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('allows SUPER to reactivate a user', async () => {
    update.mockResolvedValue({ ...user, active: true });
    await service.update(user.id, { active: true }, superCaller);
    expect(update).toHaveBeenCalled();
  });

  it('forbids a manager from reactivating a user in their tree', async () => {
    await expect(
      service.update(user.id, { active: true }, managerCaller),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('forbids PDP from changing active on their own user', async () => {
    await expect(
      service.update(
        user.id,
        { active: false },
        { id: user.id, role: Role.PDP },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids USER from updating a user', async () => {
    await expect(
      service.update(
        user.id,
        { active: false },
        { id: 'user-9', role: Role.USER },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
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
    const created = await service.create(superCaller, {
      username: 'ada',
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
    expect(created.mustChangePassword).toBe(true);
    expect(created.temporaryPassword.length).toBeGreaterThanOrEqual(4);
    expect(created).not.toHaveProperty('passwordHash');
    const stored = create.mock.calls[0]?.[0] as {
      data: {
        temporaryPassword: string;
        passwordHash: string;
        mustChangePassword: boolean;
      };
    };
    expect(stored.data.temporaryPassword).toBe(created.temporaryPassword);
    expect(stored.data.passwordHash).not.toBe(created.temporaryPassword);
    expect(stored.data.mustChangePassword).toBe(true);
  });

  it('rejects a USER without a manager', async () => {
    await expect(
      service.create(superCaller, {
        username: 'ada',
        name: 'Ada',
        role: Role.USER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a PDP without a manager', async () => {
    await expect(
      service.create(superCaller, {
        username: 'ada',
        name: 'Ada',
        role: Role.PDP,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a PDP that is assigned a pdpId', async () => {
    await expect(
      service.create(superCaller, {
        username: 'ada',
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
      service.create(superCaller, {
        username: 'ada',
        name: 'Ada',
        role: Role.MANAGER,
        pdpId: 'pdp-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a pdpId that is missing, not a PDP, or has another manager', async () => {
    await expect(
      service.create(superCaller, {
        username: 'ada',
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
      service.create(superCaller, {
        username: 'ada',
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
      service.create(superCaller, {
        username: 'ada',
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
      service.update('user-1', { managerId: 'manager-2' }, superCaller),
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
      superCaller,
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

    const updated = await service.update(
      'user-1',
      { pdpId: null },
      superCaller,
    );

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
    const result = await service.deactivate('plain', {}, superCaller);
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
      superCaller,
    );
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { managerId: 'mgr' },
      data: { managerId: 'other' },
    });
  });

  it('rejects a manager deactivation that omits the replacement', async () => {
    await expect(
      service.deactivate('mgr', {}, superCaller),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a replacement inside the closed tree', async () => {
    await expect(
      service.deactivate(
        'mgr',
        { replacementManagerId: 'child-mgr' },
        superCaller,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.deactivate(
        'mgr',
        { replacementManagerId: 'deep-mgr' },
        superCaller,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a replacement that is not an active manager', async () => {
    await expect(
      service.deactivate(
        'mgr',
        { replacementManagerId: 'inactive-mgr' },
        superCaller,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears pdpId when replacementPdpId is null', async () => {
    await service.deactivate('pdp', { replacementPdpId: null }, superCaller);
    expect(updateMany).toHaveBeenCalledWith({
      where: { pdpId: 'pdp' },
      data: { pdpId: null },
    });
  });

  it('moves assigned users to another PDP with the same manager', async () => {
    await service.deactivate(
      'pdp',
      { replacementPdpId: 'other-pdp' },
      { id: 'other', role: Role.MANAGER },
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { pdpId: 'pdp' },
      data: { pdpId: 'other-pdp' },
    });
  });

  it('rejects a replacement PDP whose manager does not match', async () => {
    await expect(
      service.deactivate('pdp', { replacementPdpId: 'wrong-pdp' }, superCaller),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a PDP deactivation that omits the replacement choice', async () => {
    await expect(
      service.deactivate('pdp', {}, superCaller),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not require a replacement for a PDP with no assigned users', async () => {
    await service.deactivate('solo-pdp', {}, superCaller);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('forbids USER from deactivating', async () => {
    await expect(
      service.deactivate('plain', {}, { id: 'plain', role: Role.USER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects deactivating a user who is already inactive', async () => {
    await expect(
      service.deactivate('gone', {}, superCaller),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects patching active to false', async () => {
    await expect(
      service.update('mgr', { active: false }, superCaller),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('UsersService caller write rules', () => {
  const findUnique = vi.fn();
  const findMany = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const updateMany = vi.fn();
  const service = new UsersService({
    user: { findUnique, findMany, create, update, updateMany },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ user: { updateMany, update } }),
  } as unknown as PrismaService);

  const managerCaller = { id: 'manager-1', role: Role.MANAGER };
  const people = [
    { ...user, id: 'manager-1', role: Role.MANAGER, managerId: null },
    {
      ...user,
      id: 'direct',
      username: 'direct',
      role: Role.USER,
      managerId: 'manager-1',
    },
    {
      ...user,
      id: 'nested',
      username: 'nested',
      role: Role.USER,
      managerId: 'direct',
    },
    {
      ...user,
      id: 'pdp-1',
      username: 'pdp',
      role: Role.PDP,
      managerId: 'manager-1',
    },
    {
      ...user,
      id: 'outside',
      username: 'outside',
      role: Role.USER,
      managerId: 'someone',
    },
  ];

  beforeEach(() => {
    findUnique.mockReset();
    findMany.mockReset();
    create.mockReset();
    update.mockReset();
    updateMany.mockReset();
    findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; username?: string } }) => {
        if (where.username) return null;
        return people.find((person) => person.id === where.id) ?? null;
      },
    );
    findMany.mockImplementation(
      async ({ where }: { where?: { managerId?: string } }) => {
        if (!where) {
          return people.map((person) => ({
            id: person.id,
            managerId: person.managerId,
          }));
        }
        return people.filter((person) => person.managerId === where.managerId);
      },
    );
    create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...user,
        ...data,
        id: 'created',
      }),
    );
    update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => ({
        ...people.find((person) => person.id === where.id),
        ...data,
      }),
    );
  });

  it('forces a manager create onto the caller and keeps an optional pdpId', async () => {
    await service.create(managerCaller, {
      username: 'ada',
      name: 'Ada',
      role: Role.USER,
      pdpId: 'pdp-1',
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: Role.USER,
        managerId: 'manager-1',
        pdpId: 'pdp-1',
      }),
    });
  });

  it('accepts a managerId that is the caller', async () => {
    await service.create(managerCaller, {
      username: 'ada',
      name: 'Ada',
      role: Role.PDP,
      managerId: 'manager-1',
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: Role.PDP,
        managerId: 'manager-1',
        pdpId: null,
      }),
    });
  });

  it('rejects a managerId that is not the caller', async () => {
    await expect(
      service.create(managerCaller, {
        username: 'ada',
        name: 'Ada',
        role: Role.USER,
        managerId: 'someone',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a manager creating a MANAGER or SUPER', async () => {
    await expect(
      service.create(managerCaller, {
        username: 'ada',
        name: 'Ada',
        role: Role.MANAGER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create(managerCaller, {
        username: 'ada',
        name: 'Ada',
        role: Role.SUPER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a PDP that a manager assigns a pdpId', async () => {
    await expect(
      service.create(managerCaller, {
        username: 'ada',
        name: 'Ada',
        role: Role.PDP,
        pdpId: 'pdp-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids PDP and USER from creating a user', async () => {
    await expect(
      service.create(
        { id: 'pdp-1', role: Role.PDP },
        {
          username: 'ada',
          name: 'Ada',
          role: Role.USER,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create(
        { id: 'direct', role: Role.USER },
        {
          username: 'ada',
          name: 'Ada',
          role: Role.USER,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('lets a manager change profile fields inside the tree', async () => {
    await service.update(
      'nested',
      { name: 'Nested', email: 'n@example.com' },
      managerCaller,
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'nested' },
      data: expect.objectContaining({ name: 'Nested', email: 'n@example.com' }),
    });
  });

  it('forbids a manager from changing protected fields or leaving the tree', async () => {
    await expect(
      service.update('direct', { username: 'other-name' }, managerCaller),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.update('outside', { name: 'Nope' }, managerCaller),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.update('manager-1', { name: 'Self' }, managerCaller),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('lets a PDP change their own profile and no one else', async () => {
    await service.update(
      'pdp-1',
      { name: 'Pat', phone: '555' },
      { id: 'pdp-1', role: Role.PDP },
    );
    expect(update).toHaveBeenCalled();
    await expect(
      service.update(
        'direct',
        { name: 'Nope' },
        { id: 'pdp-1', role: Role.PDP },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a manager deactivate a user in the tree and not outside it', async () => {
    await service.deactivate('direct', {}, managerCaller);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'direct' },
      data: { active: false },
    });
    await expect(
      service.deactivate('outside', {}, managerCaller),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deactivate('manager-1', {}, managerCaller),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids a PDP from deactivating a user', async () => {
    await expect(
      service.deactivate('direct', {}, { id: 'pdp-1', role: Role.PDP }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('UsersService temporary passwords', () => {
  const findUnique = vi.fn();
  const update = vi.fn();
  const service = new UsersService({
    user: { findUnique, update },
  } as unknown as PrismaService);

  const withTemp = {
    ...user,
    mustChangePassword: true,
    temporaryPassword: 'temp-secret',
  };

  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === user.id) return withTemp;
        return null;
      },
    );
    update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...withTemp,
        ...data,
      }),
    );
  });

  it('lets the user replace the temporary password', async () => {
    const result = await service.setOwnPassword(user.id, {
      password: 'new-secret',
      passwordConfirmation: 'new-secret',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: expect.objectContaining({
        mustChangePassword: false,
        temporaryPassword: null,
        passwordHash: expect.any(String),
      }),
    });
    const stored = update.mock.calls[0]?.[0] as {
      data: { passwordHash: string };
    };
    expect(stored.data.passwordHash).not.toBe('new-secret');
    expect(result.mustChangePassword).toBe(false);
    expect(result).not.toHaveProperty('temporaryPassword');
  });

  it('rejects a confirmation that does not match', async () => {
    await expect(
      service.setOwnPassword(user.id, {
        password: 'new-secret',
        passwordConfirmation: 'other',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns the temporary password to SUPER while it is still required', async () => {
    const result = await service.getTemporaryPassword(user.id, superCaller);
    expect(result).toEqual({ temporaryPassword: 'temp-secret' });
  });

  it('does not return a temporary password after it has been replaced', async () => {
    findUnique.mockResolvedValue({
      ...user,
      mustChangePassword: false,
      temporaryPassword: null,
    });
    await expect(
      service.getTemporaryPassword(user.id, superCaller),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids a non-SUPER from reading or issuing a temporary password', async () => {
    const manager = { id: 'manager-1', role: Role.MANAGER };
    await expect(
      service.getTemporaryPassword(user.id, manager),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.issueTemporaryPassword(user.id, manager),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('issues a new temporary password for SUPER', async () => {
    const result = await service.issueTemporaryPassword(user.id, superCaller);
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(4);
    expect(update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: expect.objectContaining({
        mustChangePassword: true,
        temporaryPassword: result.temporaryPassword,
        passwordHash: expect.any(String),
      }),
    });
    const stored = update.mock.calls[0]?.[0] as {
      data: { passwordHash: string; temporaryPassword: string };
    };
    expect(stored.data.passwordHash).not.toBe(stored.data.temporaryPassword);
  });

  it('returns 404 when the user does not exist', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      service.getTemporaryPassword('missing', superCaller),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.setOwnPassword('missing', {
        password: 'new-secret',
        passwordConfirmation: 'new-secret',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
