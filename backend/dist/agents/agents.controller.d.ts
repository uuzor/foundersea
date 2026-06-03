import { AgentsService, DecisionType } from './agents.service';
import { IdeaScorerAgent, IdeaScoreInput, IdeaScoreOutput } from './idea-scorer.agent';
import { MilestoneValidatorAgent, MilestoneValidationInput, MilestoneValidationOutput } from './milestone-validator.agent';
import { BuilderRankerAgent, BuilderRankingInput, BuilderRankingOutput } from './builder-ranker.agent';
export declare class AgentsController {
    private readonly agentsService;
    private readonly ideaScorer;
    private readonly milestoneValidator;
    private readonly builderRanker;
    constructor(agentsService: AgentsService, ideaScorer: IdeaScorerAgent, milestoneValidator: MilestoneValidatorAgent, builderRanker: BuilderRankerAgent);
    scoreIdea(input: IdeaScoreInput): Promise<IdeaScoreOutput>;
    validateMilestone(input: MilestoneValidationInput): Promise<MilestoneValidationOutput>;
    rankBuilders(input: BuilderRankingInput): Promise<BuilderRankingOutput>;
    getDecisions(): Array<{
        id: string;
        agentType: string;
        decisionType: DecisionType;
        subjectId: string;
        confidence: number;
        executed: boolean;
        timestamp: Date;
    }>;
    getDecision(id: string): {
        found: boolean;
        decision?: unknown;
    };
    getDecisionsByType(type: string): {
        type: string;
        decisions: unknown[];
        count: number;
    };
    getDecisionsBySubject(subjectId: string): {
        subjectId: string;
        decisions: unknown[];
        count: number;
    };
    getStats(): {
        totalDecisions: number;
        byType: Record<number, number>;
        averageConfidence: number;
        executedCount: number;
    };
}
export declare class ScoreIdeaDto {
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
export declare class ValidateMilestoneDto {
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
export declare class RankBuildersDto {
    ideaId: string;
    builderAddresses: string[];
    builderPortfolios: string[];
    chain: string;
}
