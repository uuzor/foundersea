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
    onChainCount: number;
  } {
    return this.agentsService.getStats();
  }

  // ========== TOKENROUTER AGENTIC LOOP TESTING ==========

  @Post('agentic/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test the TokenRouter agentic loop with a custom prompt' })
  @ApiResponse({ status: 200, description: 'Agentic loop result' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async testAgenticLoop(@Body() body: {
    systemPrompt: string;
    userMessage: string;
    maxIterations?: number;
  }): Promise<{
    success: boolean;
    finalResponse: string;
    toolCalls: Array<{ toolName: string; success: boolean; result: unknown; error?: string }>;
    iterations: number;
    error?: string;
  }> {
    // This endpoint is for testing - in production you'd have proper auth
    const { TokenRouterService } = await import('./token-router.service');
    
    try {
      const tokenRouter = new TokenRouterService(
        null as any, // config - would need proper DI in production
        null as any  // toolsService - would need proper DI in production
      );
      
      // For testing, we'll just return info about what would be called
      return {
        success: true,
        finalResponse: 'Test endpoint - use /agentic/score-idea for full testing',
        toolCalls: [],
        iterations: 0,
      };
    } catch (error) {
      return {
        success: false,
        finalResponse: '',
        toolCalls: [],
        iterations: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('tools')
  @ApiOperation({ summary: 'Get available tools for agentic loop' })
  @ApiResponse({ status: 200, description: 'Tools list' })
  getAvailableTools(): { tools: Array<{ name: string; description: string; parameters: unknown }> } {
    return {
      tools: [
        {
          name: 'web_search',
          description: 'Search the web for information about markets, competitors, etc.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              purpose: { type: 'string', description: 'Purpose of the search (market_research, competitor_check, etc.)' },
            },
            required: ['query'],
          },
        },
        {
          name: 'github_get_repo',
          description: 'Get GitHub repository information (stars, description, activity)',
          parameters: {
            type: 'object',
            properties: {
              repo_url: { type: 'string', description: 'GitHub repository URL (e.g., https://github.com/owner/repo)' },
            },
            required: ['repo_url'],
          },
        },
        {
          name: 'url_fetch',
          description: 'Fetch and analyze a URL (check availability, extract content)',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to fetch' },
              check_type: { type: 'string', description: 'Type of check (availability, content, screenshot)' },
            },
            required: ['url'],
          },
        },
        {
          name: 'github_search',
          description: 'Search GitHub for repositories matching a query',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              language: { type: 'string', description: 'Filter by programming language' },
              limit: { type: 'number', description: 'Maximum number of results' },
            },
            required: ['query'],
          },
        },
      ],
    };
  }

  @Post('agentic/score-idea')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test idea scoring via TokenRouter agentic loop' })
  @ApiResponse({ status: 200, description: 'Idea scored via agentic loop' })
  async testIdeaScoring(@Body() input: IdeaScoreInput): Promise<{
    success: boolean;
    recommendation: string;
    overallScore: number;
    confidence: number;
    reasoning: string;
    toolCalls: Array<{ toolName: string; success: boolean; result: unknown }>;
    iterations: number;
    error?: string;
  }> {
    // This would call TokenRouterService.scoreIdeaAgentic in production
    // For now, return a mock response showing the expected flow
    return {
      success: true,
      recommendation: 'ESCALATE',
      overallScore: 50,
      confidence: 50,
      reasoning: 'Test mode - set TOKENROUTER_API_KEY to enable real agentic scoring',
      toolCalls: [],
      iterations: 0,
    };
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