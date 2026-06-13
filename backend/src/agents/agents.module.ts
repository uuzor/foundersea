import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { IdeaScorerAgent } from './idea-scorer.agent';
import { MilestoneValidatorAgent } from './milestone-validator.agent';
import { BuilderRankerAgent } from './builder-ranker.agent';
import { TokenRouterService } from './token-router.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [BlockchainModule, ToolsModule],
  controllers: [AgentsController],
  providers: [AgentService, AgentsService, IdeaScorerAgent, MilestoneValidatorAgent, BuilderRankerAgent, TokenRouterService],
  exports: [AgentService, AgentsService, TokenRouterService],
})
export class AgentsModule {}
