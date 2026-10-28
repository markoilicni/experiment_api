import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { DeactivateUserDto } from './dto/deactivate-user.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import {
  ListUsersQueryDto,
  USER_SORT_FIELDS,
} from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

type AuthRequest = {
  user: { id: string; username: string; role: Role };
};

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER, Role.MANAGER)
  @ApiCreatedResponse({
    description:
      'User created with a generated temporary password. The response includes temporaryPassword once and mustChangePassword true. SUPER may create any role. MANAGER may create only USER or PDP, and managerId is forced to the caller. A different managerId is rejected. PDP and USER receive 403.',
  })
  create(@Body() dto: CreateUserDto, @Req() req: AuthRequest) {
    return this.usersService.create(req.user, dto);
  }

  @Get()
  @Roles(Role.SUPER, Role.MANAGER, Role.PDP, Role.USER)
  @ApiQuery({ name: 'sortBy', required: false, enum: USER_SORT_FIELDS })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'managerId', required: false, type: String })
  @ApiQuery({
    name: 'managerTreeId',
    required: false,
    type: String,
    description:
      'Return direct reports of this manager and everyone further down the chain. The manager is not included. Combines with managerId and the other filters using AND.',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description:
      'Case-insensitive substring match on the user name. Combines with the other filters using AND.',
  })
  @ApiQuery({
    name: 'pdpId',
    required: false,
    type: String,
    description:
      'Return users assigned to this PDP. Cannot be combined with hasPdp=false.',
  })
  @ApiQuery({
    name: 'hasPdp',
    required: false,
    enum: ['false'],
    description:
      'When false, return users whose pdpId is empty. Cannot be combined with pdpId.',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description:
      'Filter by active flag (AND with other filters). Omitted defaults to active users only. Only SUPER may pass false.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '1-based page number (default 1)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Users per page (default 100)',
  })
  @ApiOkResponse({
    description:
      'Paginated users for every role: { data, page, pageSize, total }. Pagination applies after sort and filter. A caller who is not SUPER still cannot see inactive users.',
  })
  findAll(@Query() query: ListUsersQueryDto, @Req() req: AuthRequest) {
    return this.usersService.findAll(query, req.user.role);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'The signed-in user sets their own password. password and passwordConfirmation must match and be at least 4 characters. This clears mustChangePassword and discards the readable temporary password. No other role can set this permanent password.',
  })
  setOwnPassword(@Body() dto: SetPasswordDto, @Req() req: AuthRequest) {
    return this.usersService.setOwnPassword(req.user.id, dto);
  }

  @Get(':id/temporary-password')
  @Roles(Role.SUPER)
  @ApiOkResponse({
    description:
      'SUPER only. Returns the current temporary password while mustChangePassword is true. After the user replaces it, the temporary value is gone and this returns 404.',
  })
  getTemporaryPassword(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.usersService.getTemporaryPassword(id, req.user);
  }

  @Post(':id/temporary-password')
  @Roles(Role.SUPER)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      'SUPER only. Generates a new temporary password, stores it, sets mustChangePassword to true, and returns temporaryPassword once. The super user can read it again until the user replaces it.',
  })
  issueTemporaryPassword(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.usersService.issueTemporaryPassword(id, req.user);
  }

  @Get(':id')
  @Roles(Role.SUPER, Role.MANAGER, Role.PDP, Role.USER)
  @ApiOkResponse({
    description:
      'Get user by id. Every role may call this. An inactive user is 404 unless the caller is SUPER.',
  })
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.usersService.findOne(id, req.user.role);
  }

  @Post(':id/deactivate')
  @Roles(Role.SUPER, Role.MANAGER)
  @ApiOkResponse({
    description:
      'User deactivated. SUPER may deactivate any user. MANAGER may deactivate a user in their manager tree and cannot mark that user active again. PDP and USER receive 403. A manager with direct reports requires replacementManagerId. A PDP with assigned users requires replacementPdpId.',
  })
  deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivateUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.usersService.deactivate(id, dto, req.user);
  }

  @Patch(':id')
  @Roles(Role.SUPER, Role.MANAGER, Role.PDP)
  @ApiOkResponse({
    description:
      'User updated. SUPER may change username, name, email, phone, address, role, manager, and PDP, and may set active to true. Setting active to false uses deactivate. MANAGER may change name, email, phone, and address for a user in their manager tree. PDP may change those fields on their own user. USER receives 403.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.usersService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.SUPER)
  @ApiOkResponse({ description: 'User deleted' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
