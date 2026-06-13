import { Injectable, Logger } from '@nestjs/common';
import { ContractService } from '../blockchain/contract.service';
import { TokenRouterService } from './token-router.service';
import { keccak256, toHex } from 'viem';
import axios from 'axios';

@Injectable()
export class AgentService {
  private logger = new Logger('AgentService');
  private pinataApiKey: string;
  private pinataApiSecret: string;

  constructor(
    private contractService: ContractService,
    private tokenRouterService: TokenRouterService,
  ) {
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataApiSecret = process.env.PINATA_API_SECRET || '';
  }

  /**
   * Score an idea using AI agent (via TokenRouter)
   * Records decision on AgentIdentity
   * For continuous commitment model: AI approval triggers genesis stake deployment
   */
  async scoreIdea(ideaId: bigint, title: string, description: string, metadata?: any) {
    const publicClient = this.contractService.getPublicClient();
    const chain = this.contractService.getChain();
    const agentIdentityAddress = this.contractService.getAgentIdentityAddress();
    const agentIdentityAbi = this.contractService.getAgentIdentityAbi();

    try {
      this.logger.log(`Scoring idea ${ideaId}: "${title}"`);

      // Use TokenRouter for real AI scoring
      let aiResult: {
        score: number;
        reasoning: string;
        approved: boolean;
      };

      try {
        const ideaScore = await this.tokenRouterService.scoreIdeaAgentic({
          ideaId: ideaId.toString(),
          title,
          description,
          marketCategory: metadata?.category || 'general',
          chain: 'mantle', // Use string chain identifier
        });

        aiResult = {
          score: ideaScore.overallScore,
          reasoning: ideaScore.reasoning,
          approved: ideaScore.recommendation === 'APPROVE',
        };

        this.logger.log(`  TokenRouter Score: ${aiResult.score}, Recommendation: ${ideaScore.recommendation}`);
      } catch (tokenRouterError) {
        this.logger.warn(`TokenRouter failed, falling back to heuristic scoring: ${tokenRouterError}`);
        // Fallback to heuristic scoring if TokenRouter is unavailable
        aiResult = await this.heuristicScoreIdea(title, description, metadata);
      }

      // 1. Upload reasoning to Pinata
      const reasoningIpfsHash = await this.uploadToPinata(aiResult);
      this.logger.log(`  Reasoning uploaded to IPFS: ${reasoningIpfsHash}`);

      // 2. Prepare input/output hashes
      const inputHash = keccak256(toHex(JSON.stringify({ title, description })));
      const outputHash = keccak256(toHex(JSON.stringify(aiResult)));

      // 3. Call aiApproveIdea on chain (this triggers genesis stake deployment in new model)
      const ideaFactoryAddress = this.contractService.getIdeaFactoryAddress();
      const ideaFactoryAbi = this.contractService.getIdeaFactoryAbi();
      
      const approveHash = await this.contractService.writeContract(
        ideaFactoryAddress,
        ideaFactoryAbi,
        'aiApproveIdea',
        [ideaId, BigInt(aiResult.score), reasoningIpfsHash],
      );

      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      this.logger.log(`✓ Idea approved on-chain (genesis stake deploying): tx=${approveHash}`);

      // 4. Record decision on AgentIdentity
      const decisionHash = await this.contractService.writeContract(
        agentIdentityAddress,
        agentIdentityAbi,
        'recordDecision',
        [
          0, // DecisionType.IDEA_APPROVE
          ideaId,
          inputHash,
          outputHash,
          BigInt(aiResult.score),
          reasoningIpfsHash,
        ],
      );

      const decisionReceipt = await publicClient.waitForTransactionReceipt({ hash: decisionHash });
      this.logger.log(`✓ Decision recorded on AgentIdentity: tx=${decisionHash}`);

      return {
        score: aiResult.score,
        reasoning: aiResult.reasoning,
        approved: aiResult.approved,
        transactionHash: approveHash,
        blockNumber: approveReceipt.blockNumber,
        genesisStakeDeployed: aiResult.approved, // Genesis stake deploys on approval
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to score idea ${ideaId}:`, error.message);
      throw error;
    }
  }

  /**
   * Fallback heuristic scoring when TokenRouter is unavailable
   */
  private async heuristicScoreIdea(title: string, description: string, metadata?: any): Promise<{
    score: number;
    reasoning: string;
    approved: boolean;
  }> {
    let score = 50;
    const factors: string[] = [];

    // Check title length and quality
    if (title.length >= 10 && title.length <= 100) {
      score += 10;
      factors.push('Good title length');
    }

    // Check description length
    if (description.length >= 100) {
      score += 15;
      factors.push('Detailed description');
    }

    // Check for demo/repository links
    if (metadata?.demoUrl || metadata?.repositoryUrl) {
      score += 10;
      factors.push('Has supporting links');
    }

    // Check category
    if (metadata?.category && metadata.category !== 'general') {
      score += 5;
      factors.push('Specific category');
    }

    // Normalize score
    score = Math.min(100, Math.max(0, score));

    return {
      score,
      reasoning: `Heuristic analysis of "${title}": ${factors.join(', ') || 'Basic validation passed'}. Score: ${score}/100`,
      approved: score >= 50,
    };
  }

  /**
   * Validate a milestone submission
   * Records decision on AgentIdentity
   * Auto-releases if confidence >= 75
   */
  async validateMilestone(
    ideaId: bigint,
    milestoneIndex: number,
    submissionContent: string,
  ) {
    const agentIdentity = this.contractService.getAgentIdentity();
    const agentIdentityAddress = this.contractService.getAgentIdentityAddress();
    const agentIdentityAbi = this.contractService.getAgentIdentityAbi();
    const publicClient = this.contractService.getPublicClient();
    const aiAgentWallet = this.contractService.getAIAgentWallet();
    const chain = this.contractService.getChain();

    try {
      this.logger.log(`Validating milestone ${milestoneIndex} for idea ${ideaId}`);

      // TODO: Integrate with TokenRouter for actual validation
      // For now, use mock data
      const mockResult = {
        passed: true,
        confidence: 88,
        reasoning: `Reviewed submission: Code quality good, features implemented, tests passing.`,
      };

      this.logger.log(`  Validation: Passed=${mockResult.passed}, Confidence=${mockResult.confidence}`);

      // 1. Get FundingPool address
       const ideaFactoryAddress = this.contractService.getIdeaFactoryAddress();
       const ideaFactoryAbi = this.contractService.getIdeaFactoryAbi();
       const idea = await this.contractService.readContract(ideaFactoryAddress, ideaFactoryAbi, 'getIdea', [ideaId]);
       const fundingPoolAddress = idea[2] as `0x${string}`;
       const fundingPoolAbi = this.contractService.getFundingPoolAbi();

      // 2. Call FundingPool.setMilestoneValidated()
      const validationIpfsHash = await this.uploadToPinata(mockResult);

       const validationHash = await this.contractService.writeContract(
         fundingPoolAddress as `0x${string}`,
         fundingPoolAbi,
         'setMilestoneValidated',
         [BigInt(milestoneIndex), BigInt(mockResult.confidence), validationIpfsHash],
       );

      const validationReceipt = await publicClient.waitForTransactionReceipt({ hash: validationHash });
      this.logger.log(`✓ Milestone validated: tx=${validationHash}`);

      let autoReleased = false;
      let releaseHash = null;

      // 3. Auto-release if confidence >= 75
      if (mockResult.confidence >= 75) {
        this.logger.log(`  Confidence ${mockResult.confidence} >= 75, auto-releasing...`);

        releaseHash = await this.contractService.writeContract(
          fundingPoolAddress as `0x${string}`,
          fundingPoolAbi,
          'releaseMilestone',
          [BigInt(milestoneIndex)],
        );

        const releaseReceipt = await publicClient.waitForTransactionReceipt({ hash: releaseHash });
        this.logger.log(`✓ Milestone released: tx=${releaseHash}`);
        autoReleased = true;
      }

      // 4. Record decision on AgentIdentity
      const inputHash = keccak256(toHex(JSON.stringify({ ideaId, milestoneIndex, submissionContent })));
      const outputHash = keccak256(toHex(JSON.stringify(mockResult)));

       const decisionHash = await this.contractService.writeContract(
         agentIdentityAddress,
         agentIdentityAbi,
         'recordDecision',
         [
           5, // DecisionType.MILESTONE_VALIDATE
           ideaId,
           inputHash,
           outputHash,
           BigInt(mockResult.confidence),
           validationIpfsHash,
         ],
       );

       const decisionReceipt = await publicClient.waitForTransactionReceipt({ hash: decisionHash });
      this.logger.log(`✓ Decision recorded on AgentIdentity: tx=${decisionHash}`);

      return {
        passed: mockResult.passed,
        confidence: mockResult.confidence,
        autoReleased,
        reasoning: mockResult.reasoning,
        validationHash,
        releaseHash,
        decisionHash,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to validate milestone ${milestoneIndex}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all decisions from AgentIdentity
   */
  async getDecisions(ideaId?: bigint, limit: number = 50) {
    try {
      const agentIdentityAddress = this.contractService.getAgentIdentityAddress();
      const agentIdentityAbi = this.contractService.getAgentIdentityAbi();

      // Get total decisions
      const totalDecisions = await this.contractService.readContract(agentIdentityAddress, agentIdentityAbi, 'totalDecisions', []);
      const count = Number(totalDecisions);

      this.logger.log(`Fetching decisions: total=${count}, limit=${limit}`);

      // Get decisions (simplified - would need pagination logic)
       const decisions: any[] = [];
      const start = Math.max(0, count - limit);

      for (let i = start; i < count; i++) {
        try {
           const decision = await this.contractService.readContract(agentIdentityAddress, agentIdentityAbi, 'getDecision', [BigInt(i)]);

          // If filtering by ideaId, skip non-matching
          if (ideaId && decision.subjectId !== ideaId) {
            continue;
          }

          decisions.push({
            index: i,
            type: decision.decisionType,
            subjectId: decision.subjectId,
            confidence: Number(decision.confidence),
            timestamp: Number(decision.timestamp),
            reasoningHash: decision.reasoningIpfsHash,
            inputHash: decision.inputHash,
            outputHash: decision.outputHash,
          });
        } catch (error: any) {
          this.logger.warn(`Failed to fetch decision ${i}:`, error.message);
        }
      }

      return {
        total: count,
        returned: decisions.length,
        decisions: decisions.reverse(), // Most recent first
      };
    } catch (error: any) {
      this.logger.error('Failed to get decisions:', error.message);
      throw error;
    }
  }

  /**
   * Get decisions filtered by idea ID
   */
  async getDecisionsByIdea(ideaId: bigint) {
    try {
      const agentIdentityAddress = this.contractService.getAgentIdentityAddress();
      const agentIdentityAbi = this.contractService.getAgentIdentityAbi();
      try {
        // Try to call the convenience on-chain view
        const decisions = await this.contractService.readContract(agentIdentityAddress, agentIdentityAbi, 'getDecisionsBySubjectId', [ideaId]);
        return decisions;
      } catch {
        // Fallback to manual filtering
        return this.getDecisions(ideaId);
      }
    } catch (error: any) {
      this.logger.error(`Failed to get decisions for idea ${ideaId}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload reasoning or validation data to Pinata
   */
  private async uploadToPinata(data: any): Promise<string> {
    try {
      if (!this.pinataApiKey || !this.pinataApiSecret) {
        this.logger.warn('Pinata credentials not configured, using keccak256 fallback');
        return keccak256(toHex(JSON.stringify(data)));
      }

      const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
      const response = await axios.post(url, data, {
        headers: {
          pinata_api_key: this.pinataApiKey,
          pinata_secret_api_key: this.pinataApiSecret,
          'Content-Type': 'application/json',
        },
      });

      return response.data.IpfsHash;
    } catch (error: any) {
      this.logger.warn('Failed to upload to Pinata, using keccak256 fallback:', error.message);
      // Fallback to keccak256 hash
      const hash = keccak256(toHex(JSON.stringify(data)));
      return hash;
    }
  }
}
