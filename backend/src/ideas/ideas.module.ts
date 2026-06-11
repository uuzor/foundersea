import { Module } from '@nestjs/common';
import { IdeasController } from './ideas.controller';
import { IdeaService } from './idea.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [BlockchainModule, AgentsModule],
  controllers: [IdeasController],
  providers: [IdeaService],
  exports: [IdeaService],
})
export class IdeasModule {}
