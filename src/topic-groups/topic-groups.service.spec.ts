import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { TopicGroupsService } from './topic-groups.service.js';

const discipline = {
  id: 'disc-1',
  name: 'Mathematics',
  description: 'The study of numbers',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const topicGroup = {
  id: 'tg-1',
  name: 'Algebra',
  description: null,
  disciplineId: 'disc-1',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('TopicGroupsService', () => {
  const disciplineFindUnique = vi.fn();
  const topicGroupFindUnique = vi.fn();
  const topicGroupFindFirst = vi.fn();
  const topicGroupFindMany = vi.fn();
  const topicGroupCreate = vi.fn();
  const topicGroupUpdate = vi.fn();
  const topicGroupDelete = vi.fn();
  const topicCount = vi.fn();

  const service = new TopicGroupsService({
    discipline: {
      findUnique: disciplineFindUnique,
    },
    topicGroup: {
      findUnique: topicGroupFindUnique,
      findFirst: topicGroupFindFirst,
      findMany: topicGroupFindMany,
      create: topicGroupCreate,
      update: topicGroupUpdate,
      delete: topicGroupDelete,
    },
    topic: {
      count: topicCount,
    },
  } as unknown as PrismaService);

  beforeEach(() => {
    disciplineFindUnique.mockReset();
    topicGroupFindUnique.mockReset();
    topicGroupFindFirst.mockReset();
    topicGroupFindMany.mockReset();
    topicGroupCreate.mockReset();
    topicGroupUpdate.mockReset();
    topicGroupDelete.mockReset();
    topicCount.mockReset();
  });

  describe('create', () => {
    it('creates a topic group when the discipline exists and the name is free', async () => {
      disciplineFindUnique.mockResolvedValue(discipline);
      topicGroupFindFirst.mockResolvedValue(null);
      topicGroupCreate.mockResolvedValue(topicGroup);

      const result = await service.create('disc-1', { name: 'Algebra' });

      expect(topicGroupCreate).toHaveBeenCalledWith({
        data: { name: 'Algebra', disciplineId: 'disc-1' },
      });
      expect(result).toEqual(topicGroup);
    });

    it('throws NotFoundException when the discipline does not exist', async () => {
      disciplineFindUnique.mockResolvedValue(null);

      await expect(
        service.create('missing', { name: 'Algebra' }),
      ).rejects.toThrow(NotFoundException);
      expect(topicGroupCreate).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the name is already used in the discipline', async () => {
      disciplineFindUnique.mockResolvedValue(discipline);
      topicGroupFindFirst.mockResolvedValue(topicGroup);

      await expect(
        service.create('disc-1', { name: 'Algebra' }),
      ).rejects.toThrow(ConflictException);
      expect(topicGroupCreate).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns topic groups for the discipline ordered by createdAt desc', async () => {
      disciplineFindUnique.mockResolvedValue(discipline);
      topicGroupFindMany.mockResolvedValue([topicGroup]);

      const result = await service.findAll('disc-1');

      expect(topicGroupFindMany).toHaveBeenCalledWith({
        where: { disciplineId: 'disc-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([topicGroup]);
    });

    it('throws NotFoundException when the discipline does not exist', async () => {
      disciplineFindUnique.mockResolvedValue(null);

      await expect(service.findAll('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('returns the topic group when found', async () => {
      topicGroupFindUnique.mockResolvedValue(topicGroup);

      await expect(service.findOne('tg-1')).resolves.toEqual(topicGroup);
    });

    it('throws NotFoundException when not found', async () => {
      topicGroupFindUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('renames a topic group when the new name is free', async () => {
      topicGroupFindUnique.mockResolvedValue(topicGroup);
      topicGroupFindFirst.mockResolvedValue(null);
      topicGroupUpdate.mockResolvedValue({ ...topicGroup, name: 'Geometry' });

      const result = await service.update('tg-1', { name: 'Geometry' });

      expect(topicGroupUpdate).toHaveBeenCalledWith({
        where: { id: 'tg-1' },
        data: { name: 'Geometry', disciplineId: undefined },
      });
      expect(result.name).toBe('Geometry');
    });

    it('moves a topic group to another discipline', async () => {
      topicGroupFindUnique.mockResolvedValue(topicGroup);
      disciplineFindUnique.mockResolvedValue({ ...discipline, id: 'disc-2' });
      topicGroupFindFirst.mockResolvedValue(null);
      topicGroupUpdate.mockResolvedValue({
        ...topicGroup,
        disciplineId: 'disc-2',
      });

      const result = await service.update('tg-1', { disciplineId: 'disc-2' });

      expect(topicGroupFindFirst).toHaveBeenCalledWith({
        where: { disciplineId: 'disc-2', name: 'Algebra', NOT: { id: 'tg-1' } },
      });
      expect(result.disciplineId).toBe('disc-2');
    });

    it('throws NotFoundException when the target discipline does not exist', async () => {
      topicGroupFindUnique.mockResolvedValue(topicGroup);
      disciplineFindUnique.mockResolvedValue(null);

      await expect(
        service.update('tg-1', { disciplineId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
      expect(topicGroupUpdate).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the name is taken in the target discipline', async () => {
      topicGroupFindUnique.mockResolvedValue(topicGroup);
      topicGroupFindFirst.mockResolvedValue({ ...topicGroup, id: 'tg-2' });

      await expect(
        service.update('tg-1', { name: 'Geometry' }),
      ).rejects.toThrow(ConflictException);
      expect(topicGroupUpdate).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the topic group does not exist', async () => {
      topicGroupFindUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'Geometry' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a topic group when it has no topics', async () => {
      topicGroupFindUnique.mockResolvedValue(topicGroup);
      topicCount.mockResolvedValue(0);
      topicGroupDelete.mockResolvedValue(topicGroup);

      await service.remove('tg-1');

      expect(topicGroupDelete).toHaveBeenCalledWith({ where: { id: 'tg-1' } });
    });

    it('throws ConflictException when topics still belong to it', async () => {
      topicGroupFindUnique.mockResolvedValue(topicGroup);
      topicCount.mockResolvedValue(1);

      await expect(service.remove('tg-1')).rejects.toThrow(ConflictException);
      expect(topicGroupDelete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the topic group does not exist', async () => {
      topicGroupFindUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
