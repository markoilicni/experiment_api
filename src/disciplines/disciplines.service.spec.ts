import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { DisciplinesService } from './disciplines.service.js';

const discipline = {
  id: 'disc-1',
  name: 'Mathematics',
  description: 'The study of numbers',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('DisciplinesService', () => {
  const findUnique = vi.fn();
  const findFirst = vi.fn();
  const findMany = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const deleteFn = vi.fn();
  const topicGroupCount = vi.fn();

  const service = new DisciplinesService({
    discipline: {
      findUnique,
      findFirst,
      findMany,
      create,
      update,
      delete: deleteFn,
    },
    topicGroup: {
      count: topicGroupCount,
    },
  } as unknown as PrismaService);

  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    findMany.mockReset();
    create.mockReset();
    update.mockReset();
    deleteFn.mockReset();
    topicGroupCount.mockReset();
  });

  describe('create', () => {
    it('creates a discipline when name is unique', async () => {
      findUnique.mockResolvedValue(null);
      create.mockResolvedValue(discipline);

      const result = await service.create({
        name: 'Mathematics',
        description: 'The study of numbers',
      });

      expect(create).toHaveBeenCalledWith({
        data: { name: 'Mathematics', description: 'The study of numbers' },
      });
      expect(result).toEqual(discipline);
    });

    it('throws ConflictException when name already exists', async () => {
      findUnique.mockResolvedValue(discipline);

      await expect(
        service.create({ name: 'Mathematics', description: 'Test' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns all disciplines ordered by createdAt desc', async () => {
      findMany.mockResolvedValue([discipline]);

      const result = await service.findAll();

      expect(findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([discipline]);
    });
  });

  describe('findOne', () => {
    it('returns discipline when found', async () => {
      findUnique.mockResolvedValue(discipline);

      const result = await service.findOne('disc-1');

      expect(result).toEqual(discipline);
    });

    it('throws NotFoundException when not found', async () => {
      findUnique.mockResolvedValue(null);

      await expect(service.findOne('disc-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates discipline when name is unique', async () => {
      findUnique.mockResolvedValue(discipline);
      findFirst.mockResolvedValue(null);
      update.mockResolvedValue({ ...discipline, name: 'Physics' });

      const result = await service.update('disc-1', { name: 'Physics' });

      expect(update).toHaveBeenCalled();
      expect(result.name).toBe('Physics');
    });

    it('throws ConflictException when name clashes', async () => {
      findUnique.mockResolvedValue(discipline);
      findFirst.mockResolvedValue({ ...discipline, id: 'disc-2' });

      await expect(
        service.update('disc-1', { name: 'Physics' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when discipline not found', async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        service.update('disc-999', { name: 'Physics' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes discipline when no children exist', async () => {
      findUnique.mockResolvedValue(discipline);
      topicGroupCount.mockResolvedValue(0);
      deleteFn.mockResolvedValue(discipline);

      await service.remove('disc-1');

      expect(deleteFn).toHaveBeenCalledWith({ where: { id: 'disc-1' } });
    });

    it('throws ConflictException when topic groups exist', async () => {
      findUnique.mockResolvedValue(discipline);
      topicGroupCount.mockResolvedValue(1);

      await expect(service.remove('disc-1')).rejects.toThrow(ConflictException);
      expect(deleteFn).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when discipline not found', async () => {
      findUnique.mockResolvedValue(null);

      await expect(service.remove('disc-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
