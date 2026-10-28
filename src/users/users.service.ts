import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { DeactivateUserDto } from './dto/deactivate-user.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import {
  DEFAULT_USERS_PAGE,
  DEFAULT_USERS_PAGE_SIZE,
  ListUsersQueryDto,
} from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  CreatedUser,
  PaginatedUsers,
  SafeUser,
  TemporaryPasswordResult,
  toSafeUser,
} from './users.types.js';

const SALT_ROUNDS = 10;

export type UserCaller = {
  id: string;
  role: Role;
};

async function buildTemporaryPassword() {
  const temporaryPassword = randomBytes(18).toString('base64url');
  const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
  return { temporaryPassword, passwordHash };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(caller: UserCaller, dto: CreateUserDto): Promise<CreatedUser> {
    if (caller.role !== Role.SUPER && caller.role !== Role.MANAGER) {
      throw new ForbiddenException('Cannot create a user');
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    const role = dto.role ?? Role.USER;
    let managerId = emptyToNull(dto.managerId);
    const pdpId = emptyToNull(dto.pdpId);

    if (caller.role === Role.MANAGER) {
      if (role !== Role.USER && role !== Role.PDP) {
        throw new ForbiddenException('A manager may create only USER or PDP');
      }
      if (managerId !== null && managerId !== caller.id) {
        throw new BadRequestException('managerId must be the caller');
      }
      managerId = caller.id;
    }

    if (managerId) {
      await this.ensureUserExists(managerId);
    }
    await this.assertAssignment({ role, managerId, pdpId });

    const { temporaryPassword, passwordHash } = await buildTemporaryPassword();
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        temporaryPassword,
        mustChangePassword: true,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        role,
        managerId,
        pdpId,
      },
    });
    return { ...toSafeUser(user), temporaryPassword };
  }

  async findAll(
    query: ListUsersQueryDto = {},
    callerRole: Role,
  ): Promise<PaginatedUsers> {
    if (query.active === false && callerRole !== Role.SUPER) {
      throw new ForbiddenException('Only SUPER may list inactive users');
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder === 'DESC' ? 'desc' : 'asc';
    const page = query.page ?? DEFAULT_USERS_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_USERS_PAGE_SIZE;
    const where: Prisma.UserWhereInput = {
      active: query.active ?? true,
    };
    if (query.role) {
      where.role = query.role;
    }
    if (query.managerId) {
      where.managerId = query.managerId;
    }
    if (query.managerTreeId) {
      const reports = await this.descendantIds(query.managerTreeId);
      reports.delete(query.managerTreeId);
      where.id = { in: [...reports] };
    }
    if (query.name) {
      where.name = { contains: query.name };
    }
    if (query.pdpId && query.hasPdp === false) {
      throw new BadRequestException(
        'pdpId and hasPdp=false cannot be used together',
      );
    }
    if (query.pdpId) {
      where.pdpId = query.pdpId;
    }
    if (query.hasPdp === false) {
      where.pdpId = null;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(toSafeUser),
      page,
      pageSize,
      total,
    };
  }

  async findOne(id: string, callerRole: Role): Promise<SafeUser> {
    const user = await this.ensureUserExists(id);
    if (!user.active && callerRole !== Role.SUPER) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return toSafeUser(user);
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    caller: UserCaller,
  ): Promise<SafeUser> {
    if (caller.role === Role.USER) {
      throw new ForbiddenException('Cannot update a user');
    }
    if (
      caller.role !== Role.SUPER &&
      caller.role !== Role.MANAGER &&
      caller.role !== Role.PDP
    ) {
      throw new ForbiddenException('Cannot update a user');
    }

    const existing = await this.ensureUserExists(id);

    if (caller.role === Role.PDP && id !== caller.id) {
      throw new ForbiddenException('Cannot update this user');
    }
    if (caller.role === Role.MANAGER) {
      await this.assertInManagerTree(caller.id, id);
    }
    if (caller.role === Role.MANAGER || caller.role === Role.PDP) {
      this.assertProfileFieldsOnly(dto);
    }
    if (dto.active === false) {
      throw new BadRequestException(
        'Set active to false with POST /api/v1/users/:id/deactivate',
      );
    }

    if (dto.username) {
      const clash = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException('Username already taken');
      }
    }

    const managerId =
      dto.managerId !== undefined
        ? emptyToNull(dto.managerId)
        : existing.managerId;
    const pdpId =
      dto.pdpId !== undefined ? emptyToNull(dto.pdpId) : existing.pdpId;
    const role = dto.role ?? existing.role;

    if (managerId) {
      if (managerId === id) {
        throw new ConflictException('User cannot be their own manager');
      }
      if (dto.managerId !== undefined) {
        await this.ensureUserExists(managerId);
      }
    }
    await this.assertAssignment({ role, managerId, pdpId, userId: id });

    const data: Prisma.UserUpdateInput = {
      username: dto.username,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      role: dto.role,
      active: dto.active,
    };

    if (dto.managerId !== undefined) {
      data.manager = managerId
        ? { connect: { id: managerId } }
        : { disconnect: true };
    }

    if (dto.pdpId !== undefined) {
      if (pdpId) {
        data.pdp = { connect: { id: pdpId } };
      } else if (existing.pdpId) {
        data.pdp = { disconnect: true };
      }
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    return toSafeUser(user);
  }

  async deactivate(
    id: string,
    dto: DeactivateUserDto,
    caller: UserCaller,
  ): Promise<SafeUser> {
    if (caller.role !== Role.SUPER && caller.role !== Role.MANAGER) {
      throw new ForbiddenException('Cannot deactivate a user');
    }

    const existing = await this.ensureUserExists(id);
    if (caller.role === Role.MANAGER) {
      await this.assertInManagerTree(caller.id, id);
    }
    if (!existing.active) {
      throw new BadRequestException('User is already inactive');
    }

    const directReports =
      existing.role === Role.MANAGER
        ? await this.prisma.user.findMany({
            where: { managerId: id },
            select: { id: true, managerId: true },
          })
        : [];
    const assignees =
      existing.role === Role.PDP
        ? await this.prisma.user.findMany({
            where: { pdpId: id },
            select: { id: true, managerId: true },
          })
        : [];

    if (directReports.length > 0 && !dto.replacementManagerId) {
      throw new BadRequestException('replacementManagerId is required');
    }
    if (directReports.length === 0 && dto.replacementManagerId) {
      throw new BadRequestException('replacementManagerId is not required');
    }
    if (assignees.length > 0 && dto.replacementPdpId === undefined) {
      throw new BadRequestException('replacementPdpId is required');
    }
    if (assignees.length === 0 && dto.replacementPdpId !== undefined) {
      throw new BadRequestException('replacementPdpId is not required');
    }

    if (dto.replacementManagerId) {
      await this.assertReplacementManager(id, dto.replacementManagerId);
    }
    if (dto.replacementPdpId) {
      await this.assertReplacementPdp(id, dto.replacementPdpId, assignees);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.replacementManagerId) {
        await tx.user.updateMany({
          where: { managerId: id },
          data: { managerId: dto.replacementManagerId },
        });
      }
      if (assignees.length > 0) {
        await tx.user.updateMany({
          where: { pdpId: id },
          data: { pdpId: dto.replacementPdpId ?? null },
        });
      }
      return tx.user.update({
        where: { id },
        data: { active: false },
      });
    });
    return toSafeUser(user);
  }

  async setOwnPassword(userId: string, dto: SetPasswordDto): Promise<SafeUser> {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException(
        'password and passwordConfirmation must match',
      );
    }

    await this.ensureUserExists(userId);
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        temporaryPassword: null,
      },
    });
    return toSafeUser(user);
  }

  async getTemporaryPassword(
    id: string,
    caller: UserCaller,
  ): Promise<TemporaryPasswordResult> {
    if (caller.role !== Role.SUPER) {
      throw new ForbiddenException('Only SUPER may read a temporary password');
    }

    const user = await this.ensureUserExists(id);
    if (!user.mustChangePassword || !user.temporaryPassword) {
      throw new NotFoundException('Temporary password is not available');
    }
    return { temporaryPassword: user.temporaryPassword };
  }

  async issueTemporaryPassword(
    id: string,
    caller: UserCaller,
  ): Promise<TemporaryPasswordResult> {
    if (caller.role !== Role.SUPER) {
      throw new ForbiddenException('Only SUPER may issue a temporary password');
    }

    await this.ensureUserExists(id);
    const { temporaryPassword, passwordHash } = await buildTemporaryPassword();
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        temporaryPassword,
        mustChangePassword: true,
      },
    });
    return { temporaryPassword };
  }

  async remove(id: string): Promise<void> {
    await this.ensureUserExists(id);
    await this.prisma.user.delete({ where: { id } });
  }

  private async assertAssignment(input: {
    role: Role;
    managerId: string | null;
    pdpId: string | null;
    userId?: string;
  }) {
    const managerRequired = input.role === Role.USER || input.role === Role.PDP;
    if (managerRequired && !input.managerId) {
      throw new BadRequestException('managerId is required for this role');
    }

    if (input.role !== Role.USER && input.pdpId) {
      throw new BadRequestException('pdpId must be empty for this role');
    }

    if (!input.pdpId) {
      return;
    }

    if (input.userId && input.pdpId === input.userId) {
      throw new BadRequestException(
        'pdpId must reference a user with role PDP',
      );
    }

    const pdp = await this.prisma.user.findUnique({
      where: { id: input.pdpId },
    });
    if (!pdp) {
      throw new BadRequestException('pdpId must reference an existing user');
    }
    if (pdp.role !== Role.PDP) {
      throw new BadRequestException(
        'pdpId must reference a user with role PDP',
      );
    }
    if (pdp.managerId !== input.managerId) {
      throw new BadRequestException(
        'pdpId must reference a PDP with the same managerId',
      );
    }
  }

  private assertProfileFieldsOnly(dto: UpdateUserDto) {
    const restricted = [
      dto.username !== undefined ? 'username' : null,
      dto.role !== undefined ? 'role' : null,
      dto.managerId !== undefined ? 'managerId' : null,
      dto.pdpId !== undefined ? 'pdpId' : null,
      dto.active !== undefined ? 'active' : null,
    ].filter((field) => field !== null);
    if (restricted.length > 0) {
      throw new ForbiddenException(`Cannot change ${restricted.join(', ')}`);
    }
  }

  private async assertInManagerTree(callerId: string, userId: string) {
    const tree = await this.descendantIds(callerId);
    tree.delete(callerId);
    if (!tree.has(userId)) {
      throw new ForbiddenException('User is outside the caller manager tree');
    }
  }

  private async assertReplacementManager(
    managerId: string,
    replacementId: string,
  ) {
    const replacement = await this.prisma.user.findUnique({
      where: { id: replacementId },
    });
    if (
      !replacement ||
      replacement.role !== Role.MANAGER ||
      !replacement.active
    ) {
      throw new BadRequestException(
        'replacementManagerId must reference an active user with role MANAGER',
      );
    }

    const closedTree = await this.descendantIds(managerId);
    if (closedTree.has(replacementId)) {
      throw new BadRequestException(
        'replacementManagerId must be outside the manager tree being closed',
      );
    }
  }

  private async assertReplacementPdp(
    pdpId: string,
    replacementId: string,
    assignees: { managerId: string | null }[],
  ) {
    if (replacementId === pdpId) {
      throw new BadRequestException(
        'replacementPdpId must reference another PDP',
      );
    }
    const replacement = await this.prisma.user.findUnique({
      where: { id: replacementId },
    });
    if (!replacement || replacement.role !== Role.PDP || !replacement.active) {
      throw new BadRequestException(
        'replacementPdpId must reference an active user with role PDP',
      );
    }
    const mismatched = assignees.some(
      (assignee) => assignee.managerId !== replacement.managerId,
    );
    if (mismatched) {
      throw new BadRequestException(
        'replacementPdpId must have the same manager as each assigned user',
      );
    }
  }

  private async descendantIds(rootId: string): Promise<Set<string>> {
    const users = await this.prisma.user.findMany({
      select: { id: true, managerId: true },
    });
    const children = new Map<string, string[]>();
    for (const user of users) {
      if (!user.managerId) continue;
      const list = children.get(user.managerId) ?? [];
      list.push(user.id);
      children.set(user.managerId, list);
    }

    const closed = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || closed.has(current)) continue;
      closed.add(current);
      for (const child of children.get(current) ?? []) {
        stack.push(child);
      }
    }
    return closed;
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}

export { Role };
