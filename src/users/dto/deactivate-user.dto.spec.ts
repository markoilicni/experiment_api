import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeactivateUserDto } from './deactivate-user.dto.js';

describe('DeactivateUserDto', () => {
  it('allows an empty body', async () => {
    const dto = plainToInstance(DeactivateUserDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('allows null replacementPdpId', async () => {
    const dto = plainToInstance(DeactivateUserDto, { replacementPdpId: null });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.replacementPdpId).toBeNull();
  });

  it('rejects an empty replacement id', async () => {
    const dto = plainToInstance(DeactivateUserDto, {
      replacementManagerId: '',
    });
    const errors = await validate(dto);
    expect(
      errors.some((error) => error.property === 'replacementManagerId'),
    ).toBe(true);
  });
});
