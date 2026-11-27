import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto.js';

describe('UpdateUserDto', () => {
  it('does not invent a role when the body omits it', async () => {
    const dto = plainToInstance(UpdateUserDto, { name: 'Alex', active: true });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.role).toBeUndefined();
  });
});
