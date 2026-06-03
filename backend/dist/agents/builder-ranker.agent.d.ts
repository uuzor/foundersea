import { ToolsService } from '../tools/tools.service';
import { IpfsTools } from '../tools/ipfs.tools';
import { AgentsService } from './agents.service';
export interface BuilderRankingInput {
    ideaId: string;
    builderAddresses: string[];
    builderPortfolios: string[];
    chain: string;
}
export interface BuilderRankingOutput {
    success: boolean;
    decisionId: string;
    rankings: Array<{
        address: string;
        overallScore: number;
        deliveryScore: number;
        technicalScore: number;
        proposalScore: number;
        shortlistRecommend: boolean;
        reasoning: string;
    }>;
    topPickAddress: string;
    mergerCandidates: [string, string] | null;
    summary: string;
    reasoningIpfsHash: string;
}
export declare class BuilderRankerAgent {
    private readonly toolsService;
    private readonly ipfsTools;
    private readonly agentsService;
    private readonly logger;
    constructor(toolsService: ToolsService, ipfsTools: IpfsTools, agentsService: AgentsService);
    rankBuilders(input: BuilderRankingInput): Promise<BuilderRankingOutput>;
    private calculateRankings;
    private findMergerCandidates;
    private calculateConfidence;
    private generateSummary;
    private generateReasoning;
    private hashInput;
}
