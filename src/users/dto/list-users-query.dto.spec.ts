import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListUsersQueryDto } from './list-users-query.dto.js';

async function validateQuery(query: Record<string, unknown>) {
  const dto = plainToInstance(ListUsersQueryDto, query);
  return validate(dto);
}

describe('ListUsersQueryDto', () => {
  it('allows an empty query', async () => {
    const errors = await validateQuery({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a known sort field and lowercase order', async () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      sortBy: 'email',
      sortOrder: 'desc',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.sortOrder).toBe('DESC');
  });

  it('rejects an unknown sort field', async () => {
    const errors = await validateQuery({ sortBy: 'passwordHash' });
    expect(errors.some((error) => error.property === 'sortBy')).toBe(true);
  });

  it('rejects an unknown sort order', async () => {
    const errors = await validateQuery({ sortOrder: 'sideways' });
    expect(errors.some((error) => error.property === 'sortOrder')).toBe(true);
  });

  it('accepts a role and manager id', async () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      role: 'user',
      managerId: 'manager-1',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.role).toBe(Role.USER);
  });

  it('rejects an unknown role', async () => {
    const errors = await validateQuery({ role: 'ADMIN' });
    expect(errors.some((error) => error.property === 'role')).toBe(true);
  });
});
