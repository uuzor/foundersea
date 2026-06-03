import { ToolsService } from '../tools/tools.service';
import { IpfsTools } from '../tools/ipfs.tools';
import { AgentsService } from './agents.service';
export interface MilestoneValidationInput {
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
export interface MilestoneValidationOutput {
    success: boolean;
    decisionId: string;
    recommendation: 'RELEASE_FUNDS' | 'REQUEST_REVISION' | 'REJECT';
    passed: boolean;
    confidenceScore: number;
    completenessScore: number;
    qualityScore: number;
    issuesFound: string[];
    requiredRevisions: string[] | null;
    reasoning: string;
    reasoningIpfsHash: string;
    toolEvidence: {
        commitCount: number;
        ciStatus: string;
        demoLive: boolean;
        poolHealthy: boolean;
    };
}
export declare class MilestoneValidatorAgent {
    private readonly toolsService;
    private readonly ipfsTools;
    private readonly agentsService;
    private readonly logger;
    constructor(toolsService: ToolsService, ipfsTools: IpfsTools, agentsService: AgentsService);
    validateMilestone(input: MilestoneValidationInput): Promise<MilestoneValidationOutput>;
    private calculateScores;
    private determineRecommendation;
    private generateReasoning;
    private hashInput;
}
