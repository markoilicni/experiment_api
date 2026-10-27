import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import {
  DEFAULT_USERS_PAGE,
  DEFAULT_USERS_PAGE_SIZE,
  ListUsersQueryDto,
} from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { PaginatedUsers, SafeUser, toSafeUser } from './users.types.js';

const SALT_ROUNDS = 10;

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    const role = dto.role ?? Role.USER;
    const managerId = emptyToNull(dto.managerId);
    const pdpId = emptyToNull(dto.pdpId);

    if (managerId) {
      await this.ensureUserExists(managerId);
    }
    await this.assertAssignment({ role, managerId, pdpId });

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        role,
        managerId,
        pdpId,
      },
    });
    return toSafeUser(user);
  }

  async findAll(query: ListUsersQueryDto = {}): Promise<PaginatedUsers> {
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder === 'DESC' ? 'desc' : 'asc';
    const page = query.page ?? DEFAULT_USERS_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_USERS_PAGE_SIZE;
    const where: Prisma.UserWhereInput = {};
    if (query.role) {
      where.role = query.role;
    }
    if (query.managerId) {
      where.managerId = query.managerId;
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

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.ensureUserExists(id);
    return toSafeUser(user);
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const existing = await this.ensureUserExists(id);

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

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    return toSafeUser(user);
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

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}

export { Role };
