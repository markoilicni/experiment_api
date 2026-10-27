import {
  Body,
  Controller,
  Delete,
  Get,
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
  @Roles(Role.SUPER)
  @ApiCreatedResponse({ description: 'User created' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(Role.SUPER, Role.MANAGER)
  @ApiQuery({ name: 'sortBy', required: false, enum: USER_SORT_FIELDS })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'managerId', required: false, type: String })
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
      'Paginated users: { data, page, pageSize, total }. Pagination applies after sort and filter.',
  })
  findAll(@Query() query: ListUsersQueryDto, @Req() req: AuthRequest) {
    return this.usersService.findAll(query, req.user.role);
  }

  @Get(':id')
  @Roles(Role.SUPER, Role.MANAGER)
  @ApiOkResponse({ description: 'Get user by id' })
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.usersService.findOne(id, req.user.role);
  }

  @Post(':id/deactivate')
  @Roles(Role.SUPER, Role.MANAGER)
  @ApiOkResponse({
    description:
      'User deactivated. A manager with direct reports requires replacementManagerId. A PDP with assigned users requires replacementPdpId.',
  })
  deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivateUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.usersService.deactivate(id, dto, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.SUPER)
  @ApiOkResponse({ description: 'User updated' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.usersService.update(id, dto, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER)
  @ApiOkResponse({ description: 'User deleted' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
