import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SafeUser, toSafeUser } from './users.types.js';

const SALT_ROUNDS = 10;

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

    if (dto.managerId) {
      await this.ensureUserExists(dto.managerId);
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        role: dto.role,
        managerId: dto.managerId,
      },
    });
    return toSafeUser(user);
  }

  async findAll(query: ListUsersQueryDto = {}): Promise<SafeUser[]> {
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder === 'DESC' ? 'desc' : 'asc';
    const users = await this.prisma.user.findMany({
      orderBy: { [sortBy]: sortOrder },
    });
    return users.map(toSafeUser);
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
    await this.ensureUserExists(id);

    if (dto.username) {
      const clash = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException('Username already taken');
      }
    }

    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new ConflictException('User cannot be their own manager');
      }
      await this.ensureUserExists(dto.managerId);
    }

    const data: Prisma.UserUpdateInput = {
      username: dto.username,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      role: dto.role,
    };

    if (dto.managerId !== undefined) {
      data.manager = dto.managerId
        ? { connect: { id: dto.managerId } }
        : { disconnect: true };
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

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}

export { Role };
