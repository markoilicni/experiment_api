import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { DisciplinesModule } from './disciplines/disciplines.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TopicGroupsModule } from './topic-groups/topic-groups.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    DisciplinesModule,
    TopicGroupsModule,
  ],
})
export class AppModule {}
