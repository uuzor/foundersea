import { ToolsService, ToolResult } from '../tools/tools.service';
import { IpfsTools } from '../tools/ipfs.tools';
import { AgentsService } from './agents.service';
export interface IdeaScoreInput {
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
export interface IdeaScoreOutput {
    success: boolean;
    decisionId: string;
    recommendation: 'APPROVE' | 'REJECT' | 'ESCALATE';
    overallScore: number;
    feasibilityScore: number;
    marketSizeUSD: number;
    competitionLevel: 'low' | 'medium' | 'high';
    uniquenessScore: number;
    keyRisks: string[];
    investorWarnings: string[];
    reasoning: string;
    reasoningIpfsHash: string;
    confidence: number;
    toolEvidence: {
        webSearchResults: ToolResult[];
        repoData?: ToolResult;
    };
}
export declare class IdeaScorerAgent {
    private readonly toolsService;
    private readonly ipfsTools;
    private readonly agentsService;
    private readonly logger;
    constructor(toolsService: ToolsService, ipfsTools: IpfsTools, agentsService: AgentsService);
    scoreIdea(input: IdeaScoreInput): Promise<IdeaScoreOutput>;
    private calculateScores;
    private calculateConfidence;
    private determineRecommendation;
    private generateReasoning;
    private hashInput;
}
