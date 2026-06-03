import { Injectable, Logger } from '@nestjs/common';
import { ToolsService, ToolResult } from '../tools/tools.service';
import { WalletService } from '../blockchain/wallet.service';
import { IpfsTools } from '../tools/ipfs.tools';

export enum DecisionType {
  IDEA_APPROVE = 0,
  IDEA_REJECT = 1,
  IDEA_RANK = 2,
  BUILDER_RANK = 3,
  MVP_VALIDATE = 4,
  MILESTONE_VALIDATE = 5,
  DAO_VOTE = 6,
  REVENUE_ADVICE = 7,
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
   * Record a decision on-chain via the AI agent wallet
   */
  async recordDecision(
    chain: string,
    agentIdentityAddress: string,
    decision: Omit<AgentDecision, 'id' | 'reasoningIpfsHash'>,
  ): Promise<{ txHash: string; decisionId: string }> {
    // Pin reasoning to IPFS first
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

    // Store locally for now (would call on-chain in production)
    this.decisions.push({
      ...decision,
      id: decisionId,
      reasoningIpfsHash: pinResult.ipfsHash,
    });

    this.logger.log(`Decision recorded: ${decisionId} on ${chain}`);

    return {
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`, // Mock tx hash
      decisionId,
    };
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
    };
  }
}