import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Logger,
  UseGuards,
  Req,
} from '@nestjs/common';
import { IdeaService } from './idea.service';
import { AgentService } from '../agents/agent.service';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('ideas')
export class IdeasController {
  private logger = new Logger('IdeasController');

  constructor(
    private ideaService: IdeaService,
    private agentService: AgentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new idea and trigger AI scoring' })
  @ApiResponse({ status: 201, description: 'Idea created successfully' })
  async createIdea(@Body() dto: CreateIdeaDto, @Req() req: any) {
    this.logger.log(`[POST /ideas] Creating idea: ${dto.title}`);

    try {
      // 1. Create idea on-chain
      const { ideaId, fundingPoolAddress, ideaTokenAddress, transactionHash } =
        await this.ideaService.createIdea(dto);

      this.logger.log(`✓ Idea created: ideaId=${ideaId}`);

      // 2. CRITICAL: Setup new idea (FundingPool.setAiAgent + registerBuilderAgreement)
      try {
        const builderAgreementAddress = '0x94BF2AD1A35066D396Af247985f1e5A0C68bd1c4'; // For now, use deployed BA
        await this.ideaService.setupNewIdea(BigInt(ideaId), builderAgreementAddress);
        this.logger.log(`✓ Idea setup complete`);
      } catch (setupError: any) {
        this.logger.error('⚠️ Setup failed, but idea created:', setupError.message);
        // Don't fail the request - idea is still created
      }

      // 3. ONE-TIME: Setup DAOVoting after first idea
      if (ideaId === 1n) {
        try {
          await this.ideaService.setupDAOVotingOnce(ideaTokenAddress);
          this.logger.log(`✓ DAOVoting setup complete (one-time)`);
        } catch (daoError: any) {
          this.logger.warn('⚠️ DAOVoting setup failed:', daoError.message);
          // Don't fail the request
        }
      }

      // 4. Trigger AI scoring asynchronously
      this.agentService
        .scoreIdea(BigInt(ideaId), dto.title, dto.description)
        .then((result) => {
          this.logger.log(`✓ AI scoring complete: score=${result.score}, approved=${result.approved}`);

          // If approved, also call approveIdea on contract
          if (result.approved) {
            return this.ideaService.approveIdea(BigInt(ideaId), result.score, '0x');
          }
        })
        .catch((error: any) => {
          this.logger.error('❌ AI scoring failed:', error.message);
        });

      return {
        success: true,
        ideaId: ideaId.toString(),
        fundingPoolAddress,
        ideaTokenAddress,
        status: 'PENDING_AI_REVIEW',
        transactionHash,
        message: 'Idea created successfully. AI scoring in progress...',
      };
    } catch (error: any) {
      this.logger.error('❌ Failed to create idea:', error.message);
      throw error;
    }
  }

  @Get(':ideaId')
  @ApiOperation({ summary: 'Get idea details' })
  async getIdea(@Param('ideaId') ideaId: string) {
    this.logger.log(`[GET /ideas/:ideaId] Fetching idea: ${ideaId}`);

    try {
      const idea = await this.ideaService.getIdea(BigInt(ideaId));
      return {
        success: true,
        data: idea,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to get idea ${ideaId}:`, error.message);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all ideas' })
  async listIdeas(@Query('limit') limit: string = '10') {
    this.logger.log(`[GET /ideas] Listing ideas with limit=${limit}`);

    try {
      const ideas = await this.ideaService.listIdeas(parseInt(limit));
      return {
        success: true,
        count: ideas.length,
        data: ideas,
      };
    } catch (error: any) {
      this.logger.error('❌ Failed to list ideas:', error.message);
      throw error;
    }
  }

  @Post(':ideaId/milestones/:milestoneIndex/validate')
  @ApiOperation({ summary: 'Validate a milestone and trigger AI validation' })
  async validateMilestone(
    @Param('ideaId') ideaId: string,
    @Param('milestoneIndex') milestoneIndex: string,
    @Body() dto: { submissionContent: string },
  ) {
    this.logger.log(
      `[POST /ideas/:ideaId/milestones/:index/validate] Validating milestone ${milestoneIndex} for idea ${ideaId}`,
    );

    try {
      const result = await this.agentService.validateMilestone(
        BigInt(ideaId),
        parseInt(milestoneIndex),
        dto.submissionContent,
      );

      return {
        success: true,
        milestoneIndex: parseInt(milestoneIndex),
        data: {
          passed: result.passed,
          confidence: result.confidence,
          autoReleased: result.autoReleased,
          reasoning: result.reasoning,
          transactionHashes: {
            validation: result.validationHash,
            release: result.releaseHash,
            decision: result.decisionHash,
          },
        },
        message: result.autoReleased
          ? 'Milestone validated and funds released automatically'
          : 'Milestone validated. Flagged for DAO review',
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to validate milestone:`, error.message);
      throw error;
    }
  }

  @Get('agent/decisions')
  @ApiOperation({ summary: 'Get AI agent decisions from AgentIdentity' })
  async getDecisions(
    @Query('ideaId') ideaId?: string,
    @Query('limit') limit: string = '50',
  ) {
    this.logger.log(`[GET /ideas/agent/decisions] Fetching decisions`);

    try {
      const result = await this.agentService.getDecisions(
        ideaId ? BigInt(ideaId) : undefined,
        parseInt(limit),
      );

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      this.logger.error('❌ Failed to get decisions:', error.message);
      throw error;
    }
  }
}
