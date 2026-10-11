import { Module } from '@nestjs/common';
import { DisciplinesController } from './disciplines.controller.js';
import { DisciplinesService } from './disciplines.service.js';

@Module({
  controllers: [DisciplinesController],
  providers: [DisciplinesService],
  exports: [DisciplinesService],
})
export class DisciplinesModule {}
