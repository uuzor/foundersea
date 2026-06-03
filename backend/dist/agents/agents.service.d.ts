import { ToolsService, ToolResult } from '../tools/tools.service';
import { WalletService } from '../blockchain/wallet.service';
import { IpfsTools } from '../tools/ipfs.tools';
export declare enum DecisionType {
    IDEA_APPROVE = 0,
    IDEA_REJECT = 1,
    IDEA_RANK = 2,
    BUILDER_RANK = 3,
    MVP_VALIDATE = 4,
    MILESTONE_VALIDATE = 5,
    DAO_VOTE = 6,
    REVENUE_ADVICE = 7
}
export interface AgentDecision {
    id: string;
    agentType: string;
    decisionType: DecisionType;
    subjectId: string;
    inputHash: string;
    outputHash: string;
    confidence: number;
    reasoning: string;
    reasoningIpfsHash: string;
    toolResults: ToolResult[];
    timestamp: Date;
    executed: boolean;
}
export interface AgentConfig {
    model: string;
    temperature: number;
    maxTokens: number;
}
export declare class AgentsService {
    private readonly toolsService;
    private readonly walletService;
    private readonly ipfsTools;
    private readonly logger;
    private decisions;
    constructor(toolsService: ToolsService, walletService: WalletService, ipfsTools: IpfsTools);
    recordDecision(chain: string, agentIdentityAddress: string, decision: Omit<AgentDecision, 'id' | 'reasoningIpfsHash'>): Promise<{
        txHash: string;
        decisionId: string;
    }>;
    getDecision(decisionId: string): AgentDecision | undefined;
    getAllDecisions(): AgentDecision[];
    getDecisionsByType(decisionType: DecisionType): AgentDecision[];
    getDecisionsBySubject(subjectId: string): AgentDecision[];
    getAverageConfidence(decisionType: DecisionType): number;
    getStats(): {
        totalDecisions: number;
        byType: Record<DecisionType, number>;
        averageConfidence: number;
        executedCount: number;
    };
}
