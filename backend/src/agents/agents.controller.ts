import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AgentsService, DecisionType } from './agents.service';
import { IdeaScorerAgent, IdeaScoreInput, IdeaScoreOutput } from './idea-scorer.agent';
import { MilestoneValidatorAgent, MilestoneValidationInput, MilestoneValidationOutput } from './milestone-validator.agent';
import { BuilderRankerAgent, BuilderRankingInput, BuilderRankingOutput } from './builder-ranker.agent';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly ideaScorer: IdeaScorerAgent,
    private readonly milestoneValidator: MilestoneValidatorAgent,
    private readonly builderRanker: BuilderRankerAgent,
  ) {}

  // ========== IDEA SCORING ==========

  @Post('ideas/score')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Score an idea using AI agent' })
  @ApiResponse({ status: 200, description: 'Idea scored successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async scoreIdea(@Body() input: IdeaScoreInput): Promise<IdeaScoreOutput> {
    return this.ideaScorer.scoreIdea(input);
  }

  // ========== MILESTONE VALIDATION ==========

  @Post('milestones/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a milestone using AI agent' })
  @ApiResponse({ status: 200, description: 'Milestone validated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async validateMilestone(@Body() input: MilestoneValidationInput): Promise<MilestoneValidationOutput> {
    return this.milestoneValidator.validateMilestone(input);
  }

  // ========== BUILDER RANKING ==========

  @Post('builders/rank')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rank builders using AI agent' })
  @ApiResponse({ status: 200, description: 'Builders ranked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async rankBuilders(@Body() input: BuilderRankingInput): Promise<BuilderRankingOutput> {
    return this.builderRanker.rankBuilders(input);
  }

  // ========== DECISION HISTORY ==========

  @Get('decisions')
  @ApiOperation({ summary: 'Get all AI agent decisions' })
  @ApiResponse({ status: 200, description: 'Decisions retrieved successfully' })
  getDecisions(): Array<{
    id: string;
    agentType: string;
    decisionType: DecisionType;
    subjectId: string;
    confidence: number;
    executed: boolean;
    timestamp: Date;
  }> {
    return this.agentsService.getAllDecisions().map((d) => ({
      id: d.id,
      agentType: d.agentType,
      decisionType: d.decisionType,
      subjectId: d.subjectId,
      confidence: d.confidence,
      executed: d.executed,
      timestamp: d.timestamp,
    }));
  }

  @Get('decisions/:id')
  @ApiOperation({ summary: 'Get a specific decision by ID' })
  @ApiResponse({ status: 200, description: 'Decision retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Decision not found' })
  getDecision(@Param('id') id: string): { found: boolean; decision?: unknown } {
    const decision = this.agentsService.getDecision(id);
    return {
      found: !!decision,
      decision,
    };
  }

  @Get('decisions/type/:type')
  @ApiOperation({ summary: 'Get decisions by type' })
  @ApiResponse({ status: 200, description: 'Decisions retrieved successfully' })
  getDecisionsByType(@Param('type') type: string): { type: string; decisions: unknown[]; count: number } {
    const decisionType = parseInt(type, 10) as DecisionType;
    const decisions = this.agentsService.getDecisionsByType(decisionType);
    return {
      type,
      decisions,
      count: decisions.length,
    };
  }

  @Get('decisions/subject/:subjectId')
  @ApiOperation({ summary: 'Get decisions for a subject (idea, milestone, etc.)' })
  @ApiResponse({ status: 200, description: 'Decisions retrieved successfully' })
  getDecisionsBySubject(@Param('subjectId') subjectId: string): { subjectId: string; decisions: unknown[]; count: number } {
    const decisions = this.agentsService.getDecisionsBySubject(subjectId);
    return {
      subjectId,
      decisions,
      count: decisions.length,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get decision statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  getStats(): {
    totalDecisions: number;
    byType: Record<number, number>;
    averageConfidence: number;
    executedCount: number;
  } {
    return this.agentsService.getStats();
  }
}

// Swagger DTOs
export class ScoreIdeaDto {
  ideaId: string;
  title: string;
  description: string;
  marketCategory: string;
  demoUrl?: string;
  repositoryUrl?: string;
  creatorAddress: string;
  fundingGoal: string;
  chain: string;
}

export class ValidateMilestoneDto {
  milestoneId: string;
  ideaId: string;
  builderAddress: string;
  repositoryUrl: string;
  demoUrl?: string;
  milestoneStartDate: string;
  expectedDeliverables: string;
  claimedCompletion: string;
  chain: string;
}

export class RankBuildersDto {
  ideaId: string;
  builderAddresses: string[];
  builderPortfolios: string[];
  chain: string;
}