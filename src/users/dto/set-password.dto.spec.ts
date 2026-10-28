import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetPasswordDto } from './set-password.dto.js';

describe('SetPasswordDto', () => {
  it('accepts a password and matching confirmation of the minimum length', async () => {
    const dto = plainToInstance(SetPasswordDto, {
      password: 'secret',
      passwordConfirmation: 'secret',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a password shorter than 4 characters', async () => {
    const dto = plainToInstance(SetPasswordDto, {
      password: 'abc',
      passwordConfirmation: 'abc',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
