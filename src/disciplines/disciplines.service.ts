import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDisciplineDto } from './dto/create-discipline.dto.js';
import { UpdateDisciplineDto } from './dto/update-discipline.dto.js';

@Injectable()
export class DisciplinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDisciplineDto) {
    const existing = await this.prisma.discipline.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Discipline name already exists');
    }

    return this.prisma.discipline.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.discipline.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id },
    });
    if (!discipline) {
      throw new NotFoundException(`Discipline ${id} not found`);
    }
    return discipline;
  }

  async update(id: string, dto: UpdateDisciplineDto) {
    await this.ensureDisciplineExists(id);

    if (dto.name) {
      const clash = await this.prisma.discipline.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException('Discipline name already exists');
      }
    }

    return this.prisma.discipline.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async remove(id: string) {
    await this.ensureDisciplineExists(id);

    const topicGroupCount = await this.prisma.topicGroup.count({
      where: { disciplineId: id },
    });

    if (topicGroupCount > 0) {
      throw new ConflictException(
        'Cannot delete discipline with existing topic groups',
      );
    }

    await this.prisma.discipline.delete({ where: { id } });
  }

  private async ensureDisciplineExists(id: string) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id },
    });
    if (!discipline) {
      throw new NotFoundException(`Discipline ${id} not found`);
    }
    return discipline;
  }
}
