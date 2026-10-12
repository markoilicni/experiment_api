import { Module } from '@nestjs/common';
import { TopicGroupsController } from './topic-groups.controller.js';
import { TopicGroupsService } from './topic-groups.service.js';

@Module({
  controllers: [TopicGroupsController],
  providers: [TopicGroupsService],
  exports: [TopicGroupsService],
})
export class TopicGroupsModule {}
