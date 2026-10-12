import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateTopicGroupDto } from './dto/create-topic-group.dto.js';
import { UpdateTopicGroupDto } from './dto/update-topic-group.dto.js';
import { TopicGroupsService } from './topic-groups.service.js';

@ApiTags('topic-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TopicGroupsController {
  constructor(private readonly topicGroupsService: TopicGroupsService) {}

  @Post('disciplines/:disciplineId/topic-groups')
  @Roles(Role.SUPER)
  @ApiCreatedResponse({ description: 'Topic group created' })
  @ApiNotFoundResponse({ description: 'Discipline not found' })
  @ApiConflictResponse({
    description: 'Topic group name already exists in this discipline',
  })
  create(
    @Param('disciplineId') disciplineId: string,
    @Body() dto: CreateTopicGroupDto,
  ) {
    return this.topicGroupsService.create(disciplineId, dto);
  }

  @Get('disciplines/:disciplineId/topic-groups')
  @ApiOkResponse({ description: 'List topic groups for a discipline' })
  @ApiNotFoundResponse({ description: 'Discipline not found' })
  findAll(@Param('disciplineId') disciplineId: string) {
    return this.topicGroupsService.findAll(disciplineId);
  }

  @Get('topic-groups/:id')
  @ApiOkResponse({ description: 'Get topic group by id' })
  @ApiNotFoundResponse({ description: 'Topic group not found' })
  findOne(@Param('id') id: string) {
    return this.topicGroupsService.findOne(id);
  }

  @Patch('topic-groups/:id')
  @Roles(Role.SUPER)
  @ApiOkResponse({ description: 'Topic group updated' })
  @ApiNotFoundResponse({ description: 'Topic group or discipline not found' })
  @ApiConflictResponse({
    description: 'Topic group name already exists in this discipline',
  })
  update(@Param('id') id: string, @Body() dto: UpdateTopicGroupDto) {
    return this.topicGroupsService.update(id, dto);
  }

  @Delete('topic-groups/:id')
  @Roles(Role.SUPER)
  @ApiOkResponse({ description: 'Topic group deleted' })
  @ApiNotFoundResponse({ description: 'Topic group not found' })
  @ApiConflictResponse({
    description: 'Cannot delete topic group with existing topics',
  })
  remove(@Param('id') id: string) {
    return this.topicGroupsService.remove(id);
  }
}
