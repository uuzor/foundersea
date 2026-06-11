import { ToolsService, ToolResult } from '../tools/tools.service';
import { WalletService } from '../blockchain/wallet.service';
import { IpfsTools } from '../tools/ipfs.tools';
import { DecisionType } from '../blockchain/abi/AgentIdentity';
export { DecisionType } from '../blockchain/abi/AgentIdentity';
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
    chain?: string;
    onChainTxHash?: string;
    onChainBlockNumber?: number;
    onChainIndex?: number;
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
    recordDecision(chain: string, agentIdentityAddress: string, decision: Omit<AgentDecision, 'id' | 'reasoningIpfsHash' | 'onChainTxHash' | 'onChainBlockNumber' | 'onChainIndex'>): Promise<{
        txHash: string;
        decisionId: string;
        onChainIndex: number;
    }>;
    recordDecisionLocalOnly(decision: Omit<AgentDecision, 'id' | 'reasoningIpfsHash' | 'chain' | 'onChainTxHash' | 'onChainBlockNumber' | 'onChainIndex'>): Promise<{
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
        onChainCount: number;
    };
    syncWithOnChain(chain: string): Promise<{
        localCount: number;
        onChainCount: number;
        synced: boolean;
    }>;
}
