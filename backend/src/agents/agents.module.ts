import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { IdeaScorerAgent } from './idea-scorer.agent';
import { MilestoneValidatorAgent } from './milestone-validator.agent';
import { BuilderRankerAgent } from './builder-ranker.agent';
import { TokenRouterService } from './token-router.service';
import { ToolsModule } from '../tools/tools.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [ToolsModule, BlockchainModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    IdeaScorerAgent,
    MilestoneValidatorAgent,
    BuilderRankerAgent,
    TokenRouterService,
  ],
  exports: [
    AgentsService,
    IdeaScorerAgent,
    MilestoneValidatorAgent,
    BuilderRankerAgent,
    TokenRouterService,
  ],
})
export class AgentsModule {}