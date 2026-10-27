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

  it('accepts a pdp id and hasPdp false', async () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      pdpId: 'pdp-1',
      hasPdp: 'false',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.hasPdp).toBe(false);
  });

  it('rejects hasPdp values other than false', async () => {
    const errors = await validateQuery({ hasPdp: 'true' });
    expect(errors.some((error) => error.property === 'hasPdp')).toBe(true);
  });

  it('rejects an unknown role', async () => {
    const errors = await validateQuery({ role: 'ADMIN' });
    expect(errors.some((error) => error.property === 'role')).toBe(true);
  });

  it('accepts active as a boolean string', async () => {
    const dto = plainToInstance(ListUsersQueryDto, { active: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.active).toBe(false);
  });

  it('rejects a non-boolean active value', async () => {
    const errors = await validateQuery({ active: 'maybe' });
    expect(errors.some((error) => error.property === 'active')).toBe(true);
  });

  it('accepts positive page and pageSize integers', async () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      page: '2',
      pageSize: '25',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(25);
  });

  it('rejects page or pageSize that are not integers greater than 0', async () => {
    const zeroPage = await validateQuery({ page: 0 });
    expect(zeroPage.some((error) => error.property === 'page')).toBe(true);

    const negativeSize = await validateQuery({ pageSize: -1 });
    expect(negativeSize.some((error) => error.property === 'pageSize')).toBe(
      true,
    );

    const fractional = await validateQuery({ page: 1.5 });
    expect(fractional.some((error) => error.property === 'page')).toBe(true);
  });
});
