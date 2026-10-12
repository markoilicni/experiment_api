import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTopicGroupDto } from './dto/create-topic-group.dto.js';
import { UpdateTopicGroupDto } from './dto/update-topic-group.dto.js';

@Injectable()
export class TopicGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(disciplineId: string, dto: CreateTopicGroupDto) {
    await this.ensureDisciplineExists(disciplineId);
    await this.ensureNameAvailable(disciplineId, dto.name);

    return this.prisma.topicGroup.create({
      data: {
        name: dto.name,
        disciplineId,
      },
    });
  }

  async findAll(disciplineId: string) {
    await this.ensureDisciplineExists(disciplineId);

    return this.prisma.topicGroup.findMany({
      where: { disciplineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const topicGroup = await this.prisma.topicGroup.findUnique({
      where: { id },
    });
    if (!topicGroup) {
      throw new NotFoundException(`Topic group ${id} not found`);
    }
    return topicGroup;
  }

  async update(id: string, dto: UpdateTopicGroupDto) {
    const topicGroup = await this.findOne(id);
    const disciplineId = dto.disciplineId ?? topicGroup.disciplineId;
    const name = dto.name ?? topicGroup.name;

    if (disciplineId !== topicGroup.disciplineId) {
      await this.ensureDisciplineExists(disciplineId);
    }

    if (name !== topicGroup.name || disciplineId !== topicGroup.disciplineId) {
      await this.ensureNameAvailable(disciplineId, name, id);
    }

    return this.prisma.topicGroup.update({
      where: { id },
      data: {
        name: dto.name,
        disciplineId: dto.disciplineId,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const topicCount = await this.prisma.topic.count({
      where: { topicGroupId: id },
    });
    if (topicCount > 0) {
      throw new ConflictException(
        'Cannot delete topic group with existing topics',
      );
    }

    await this.prisma.topicGroup.delete({ where: { id } });
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

  private async ensureNameAvailable(
    disciplineId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.topicGroup.findFirst({
      where: {
        disciplineId,
        name,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Topic group name already exists in this discipline',
      );
    }
  }
}
