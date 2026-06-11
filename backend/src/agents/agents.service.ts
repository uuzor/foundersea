import { Injectable, Logger } from '@nestjs/common';
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
  // On-chain tracking
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

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private decisions: AgentDecision[] = [];

  constructor(
    private readonly toolsService: ToolsService,
    private readonly walletService: WalletService,
    private readonly ipfsTools: IpfsTools,
  ) {}

  /**
   * Record a decision both locally and on-chain via AgentIdentity contract
   */
  async recordDecision(
    chain: string,
    agentIdentityAddress: string,
    decision: Omit<AgentDecision, 'id' | 'reasoningIpfsHash' | 'onChainTxHash' | 'onChainBlockNumber' | 'onChainIndex'>,
  ): Promise<{ txHash: string; decisionId: string; onChainIndex: number }> {
    // Pin reasoning to IPFS first; fall back to local mock hash on failure
    let pinResult = await this.ipfsTools.pinReasoning(decision.reasoning, {
      agentType: decision.agentType,
      decisionType: decision.decisionType,
      subjectId: decision.subjectId,
      confidence: decision.confidence,
    });

    if (!pinResult.success || !pinResult.ipfsHash) {
      this.logger.warn('IPFS pin failed, using local mock hash for decision recording');
      const mockHash = `Qm${Math.random().toString(36).substring(2, 46)}`;
      pinResult = { success: true, ipfsHash: mockHash, pinUrl: `https://ipfs.io/ipfs/${mockHash}` };
    }

    const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Hash input and output data for on-chain storage
    const inputData = JSON.stringify({
      agentType: decision.agentType,
      decisionType: decision.decisionType,
      subjectId: decision.subjectId,
      timestamp: decision.timestamp.toISOString(),
    });
    const inputHash = this.walletService.hashInputForChain(inputData);
    const outputJson = JSON.stringify({
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      toolResults: decision.toolResults,
    });
    const outputHash = this.walletService.hashOutputForChain(outputJson);

    let onChainResult = {
      txHash: '',
      blockNumber: 0,
      decisionIndex: -1,
    };

    // Try to record on-chain if wallet is configured
    try {
      onChainResult = await this.walletService.recordDecisionOnChain(chain, {
        decisionType: decision.decisionType,
        subjectId: parseInt(decision.subjectId, 10),
        inputHash,
        outputHash,
        confidence: decision.confidence,
        reasoningIpfsHash: pinResult.ipfsHash!,
      });
      this.logger.log(`Decision recorded on-chain on ${chain}: ${onChainResult.txHash}`);
    } catch (error) {
      this.logger.warn(`Failed to record decision on-chain (will store locally): ${error}`);
      // Fall back to local storage only
      onChainResult.txHash = `local_${Date.now()}`;
    }

    // Store locally with on-chain info
    this.decisions.push({
      ...decision,
      id: decisionId,
      reasoningIpfsHash: pinResult.ipfsHash!,
      chain,
      onChainTxHash: onChainResult.txHash,
      onChainBlockNumber: onChainResult.blockNumber,
      onChainIndex: onChainResult.decisionIndex,
    });

    this.logger.log(`Decision recorded: ${decisionId} on ${chain}`);

    return {
      txHash: onChainResult.txHash,
      decisionId,
      onChainIndex: onChainResult.decisionIndex,
    };
  }

  /**
   * Record decision locally only (no on-chain transaction)
   * Use this when on-chain recording fails or is not needed
   */
  async recordDecisionLocalOnly(
    decision: Omit<AgentDecision, 'id' | 'reasoningIpfsHash' | 'chain' | 'onChainTxHash' | 'onChainBlockNumber' | 'onChainIndex'>,
  ): Promise<{ decisionId: string }> {
    const pinResult = await this.ipfsTools.pinReasoning(decision.reasoning, {
      agentType: decision.agentType,
      decisionType: decision.decisionType,
      subjectId: decision.subjectId,
      confidence: decision.confidence,
    });

    if (!pinResult.success || !pinResult.ipfsHash) {
      throw new Error('Failed to pin reasoning to IPFS');
    }

    const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.decisions.push({
      ...decision,
      id: decisionId,
      reasoningIpfsHash: pinResult.ipfsHash,
    });

    return { decisionId };
  }

  /**
   * Get decision by ID
   */
  getDecision(decisionId: string): AgentDecision | undefined {
    return this.decisions.find((d) => d.id === decisionId);
  }

  /**
   * Get all decisions
   */
  getAllDecisions(): AgentDecision[] {
    return this.decisions;
  }

  /**
   * Get decisions by type
   */
  getDecisionsByType(decisionType: DecisionType): AgentDecision[] {
    return this.decisions.filter((d) => d.decisionType === decisionType);
  }

  /**
   * Get decisions by subject
   */
  getDecisionsBySubject(subjectId: string): AgentDecision[] {
    return this.decisions.filter((d) => d.subjectId === subjectId);
  }

  /**
   * Get average confidence by decision type
   */
  getAverageConfidence(decisionType: DecisionType): number {
    const decisions = this.getDecisionsByType(decisionType);
    if (decisions.length === 0) return 0;
    const sum = decisions.reduce((acc, d) => acc + d.confidence, 0);
    return sum / decisions.length;
  }

  /**
   * Get decision statistics
   */
  getStats(): {
    totalDecisions: number;
    byType: Record<DecisionType, number>;
    averageConfidence: number;
    executedCount: number;
    onChainCount: number;
  } {
    const byType: Record<DecisionType, number> = {
      [DecisionType.IDEA_APPROVE]: 0,
      [DecisionType.IDEA_REJECT]: 0,
      [DecisionType.IDEA_RANK]: 0,
      [DecisionType.BUILDER_RANK]: 0,
      [DecisionType.MVP_VALIDATE]: 0,
      [DecisionType.MILESTONE_VALIDATE]: 0,
      [DecisionType.DAO_VOTE]: 0,
      [DecisionType.REVENUE_ADVICE]: 0,
    };

    for (const decision of this.decisions) {
      byType[decision.decisionType]++;
    }

    const total = this.decisions.length;
    const avgConfidence =
      total > 0
        ? this.decisions.reduce((acc, d) => acc + d.confidence, 0) / total
        : 0;

    return {
      totalDecisions: total,
      byType,
      averageConfidence: avgConfidence,
      executedCount: this.decisions.filter((d) => d.executed).length,
      onChainCount: this.decisions.filter((d) => d.onChainTxHash && !d.onChainTxHash.startsWith('local_')).length,
    };
  }

  /**
   * Sync local decisions with on-chain state
   * Useful for verifying that decisions were recorded correctly
   */
  async syncWithOnChain(chain: string): Promise<{
    localCount: number;
    onChainCount: number;
    synced: boolean;
  }> {
    const localCount = this.decisions.filter((d) => d.chain === chain).length;
    let onChainCount = 0;

    try {
      onChainCount = await this.walletService.getOnChainDecisionCount(chain);
    } catch (error) {
      this.logger.error(`Failed to get on-chain count for ${chain}: ${error}`);
    }

    return {
      localCount,
      onChainCount,
      synced: localCount === onChainCount,
    };
  }
}