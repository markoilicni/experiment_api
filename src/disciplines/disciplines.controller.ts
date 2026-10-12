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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateDisciplineDto } from './dto/create-discipline.dto.js';
import { UpdateDisciplineDto } from './dto/update-discipline.dto.js';
import { DisciplinesService } from './disciplines.service.js';

@ApiTags('disciplines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disciplines')
export class DisciplinesController {
  constructor(private readonly disciplinesService: DisciplinesService) {}

  @Post()
  @Roles(Role.SUPER)
  @ApiCreatedResponse({ description: 'Discipline created' })
  @ApiConflictResponse({ description: 'Discipline name already exists' })
  create(@Body() dto: CreateDisciplineDto) {
    return this.disciplinesService.create(dto);
  }

  @Get()
  @ApiOkResponse({ description: 'List all disciplines' })
  findAll() {
    return this.disciplinesService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Get discipline by id' })
  @ApiNotFoundResponse({ description: 'Discipline not found' })
  findOne(@Param('id') id: string) {
    return this.disciplinesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER)
  @ApiOkResponse({ description: 'Discipline updated' })
  @ApiNotFoundResponse({ description: 'Discipline not found' })
  @ApiConflictResponse({ description: 'Discipline name already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateDisciplineDto) {
    return this.disciplinesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER)
  @ApiOkResponse({ description: 'Discipline deleted' })
  @ApiNotFoundResponse({ description: 'Discipline not found' })
  @ApiConflictResponse({ description: 'Cannot delete discipline with existing topic groups' })
  remove(@Param('id') id: string) {
    return this.disciplinesService.remove(id);
  }
}
