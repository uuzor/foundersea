import { Injectable, Logger } from '@nestjs/common';
import { ToolsService, ToolResult } from '../tools/tools.service';
import { IpfsTools } from '../tools/ipfs.tools';
import { AgentsService, DecisionType } from './agents.service';

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

// System prompt for MilestoneValidator agent
const MILESTONE_VALIDATOR_SYSTEM = `You are an autonomous technical reviewer for a decentralized funding protocol.
Your decision directly triggers or blocks fund release. Builder is counting on you. Be fair but rigorous.

Your tool sequence (follow this order):
1. github_get_commits — verify builder was actually working during this period
2. github_get_test_results — CI status is binary evidence
3. github_get_file(README.md) — read what they claim to have built
4. url_fetch(demo_url) — verify the demo exists and is accessible
5. web_search(product_name, "demo_verification") — verify it's publicly known/live
6. get_funding_pool_state — verify pool is healthy before you release funds
7. ipfs_pin_reasoning — pin your full decision BEFORE returning

Then return ONLY valid JSON:
{
  "passed": boolean,
  "confidenceScore": 0-100,
  "completenessScore": 0-100,
  "qualityScore": 0-100,
  "issuesFound": string[],
  "requiredRevisions": string[] | null,
  "recommendation": "RELEASE_FUNDS|REQUEST_REVISION|REJECT",
  "reasoning": string,
  "toolEvidence": {
    "commitCount": number,
    "ciStatus": string,
    "demoLive": boolean,
    "poolHealthy": boolean
  }
}

RELEASE_FUNDS only if: confidence ≥ 75, CI passing, demo live, commits present.
REQUEST_REVISION if: confidence 50-74 or minor gaps.
REJECT if: fundamentally incomplete, no commits, fraudulent.`;

@Injectable()
export class MilestoneValidatorAgent {
  private readonly logger = new Logger(MilestoneValidatorAgent.name);

  constructor(
    private readonly toolsService: ToolsService,
    private readonly ipfsTools: IpfsTools,
    private readonly agentsService: AgentsService,
  ) {}

  /**
   * Execute the milestone validation agent loop
   */
  async validateMilestone(input: MilestoneValidationInput): Promise<MilestoneValidationOutput> {
    this.logger.log(`Validating milestone: ${input.milestoneId} for builder: ${input.builderAddress}`);

    const toolResults: ToolResult[] = [];
    let commitCount = 0;
    let ciStatus = 'unknown';
    let demoLive = false;
    let poolHealthy = false;

    try {
      // Step 1: Verify commits in milestone period
      this.logger.log('Step 1: Checking commits...');
      const commitsResult = await this.toolsService.executeTool('github_get_commits', {
        repo_url: input.repositoryUrl,
        since_date: input.milestoneStartDate,
        until_date: new Date().toISOString(),
      });
      toolResults.push(commitsResult);

      if (commitsResult.success && commitsResult.data) {
        const commits = commitsResult.data as Array<{ sha: string }>;
        commitCount = commits.length;
      }

      // Step 2: Check CI status
      this.logger.log('Step 2: Checking CI...');
      const ciResult = await this.toolsService.executeTool('github_get_test_results', {
        repo_url: input.repositoryUrl,
      });
      toolResults.push(ciResult);

      if (ciResult.success && ciResult.data) {
        const testData = ciResult.data as { status: string };
        ciStatus = testData.status;
      }

      // Step 3: Read README to verify deliverables
      this.logger.log('Step 3: Reading README...');
      let readmeResult: ToolResult | null = null;
      try {
        readmeResult = await this.toolsService.executeTool('github_get_file', {
          repo_url: input.repositoryUrl,
          file_path: 'README.md',
        });
        toolResults.push(readmeResult);
      } catch {
        this.logger.warn('Could not fetch README');
      }

      // Step 4: Check demo URL
      let demoLive = false;
      if (input.demoUrl) {
        this.logger.log('Step 4: Checking demo...');
        const demoResult = await this.toolsService.executeTool('url_fetch', {
          url: input.demoUrl,
          check_type: 'availability',
        });
        toolResults.push(demoResult);
        const demoData = demoResult.data as { isAvailable?: boolean } | undefined;
        demoLive = demoResult.success && !!(demoData?.isAvailable);
      }

      // Step 5: Verify demo is publicly known
      this.logger.log('Step 5: Verifying market presence...');
      const searchResult = await this.toolsService.executeTool('web_search', {
        query: input.claimedCompletion,
        purpose: 'demo_verification',
      });
      toolResults.push(searchResult);

      // Step 6: Check funding pool health
      this.logger.log('Step 6: Checking pool health...');
      let poolHealthy = false;
      try {
        const poolResult = await this.toolsService.executeTool('get_funding_pool_state', {
          chain: input.chain,
          ideaId: input.ideaId,
        });
        toolResults.push(poolResult);
        const poolData = poolResult.data as { raisedAmount?: string } | undefined;
        poolHealthy = poolResult.success && !!(poolData?.raisedAmount && poolData.raisedAmount !== '0');
      } catch {
        this.logger.warn('Could not check pool health');
      }

      // Step 7: Calculate scores and make decision
      this.logger.log('Step 7: Making decision...');

      const scores = this.calculateScores(commitCount, ciStatus, demoLive, readmeResult);
      const confidence = scores.confidence;
      const recommendation = this.determineRecommendation(scores, confidence);

      // Pin reasoning
      const reasoning = this.generateReasoning(input, scores, recommendation, {
        commitCount,
        ciStatus,
        demoLive,
        poolHealthy,
      });
      const pinResult = await this.ipfsTools.pinReasoning(reasoning, {
        type: 'milestone_validation',
        milestoneId: input.milestoneId,
        recommendation,
        scores,
        toolEvidence: { commitCount, ciStatus, demoLive, poolHealthy },
      });

      // Record decision
      const { decisionId } = await this.agentsService.recordDecision(input.chain, '', {
        agentType: 'MilestoneValidatorAgent',
        decisionType: DecisionType.MILESTONE_VALIDATE,
        subjectId: input.milestoneId,
        inputHash: this.hashInput(input),
        outputHash: pinResult.ipfsHash || '',
        confidence,
        reasoning,
        toolResults,
        timestamp: new Date(),
        executed: recommendation === 'RELEASE_FUNDS',
      });

      return {
        success: true,
        decisionId,
        recommendation,
        passed: recommendation === 'RELEASE_FUNDS',
        confidenceScore: scores.confidence,
        completenessScore: scores.completeness,
        qualityScore: scores.quality,
        issuesFound: scores.issues,
        requiredRevisions: recommendation === 'REQUEST_REVISION' ? scores.revisions : null,
        reasoning,
        reasoningIpfsHash: pinResult.ipfsHash || '',
        toolEvidence: {
          commitCount,
          ciStatus,
          demoLive,
          poolHealthy,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to validate milestone: ${input.milestoneId}`, error);
      return {
        success: false,
        decisionId: '',
        recommendation: 'REQUEST_REVISION',
        passed: false,
        confidenceScore: 0,
        completenessScore: 0,
        qualityScore: 0,
        issuesFound: [error instanceof Error ? error.message : 'Unknown error'],
        requiredRevisions: ['AI validation failed - manual review required'],
        reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reasoningIpfsHash: '',
        toolEvidence: {
          commitCount: 0,
          ciStatus: 'unknown',
          demoLive: false,
          poolHealthy: false,
        },
      };
    }
  }

  private calculateScores(
    commitCount: number,
    ciStatus: string,
    demoLive: boolean,
    readmeResult: ToolResult | null,
  ): {
    confidence: number;
    completeness: number;
    quality: number;
    issues: string[];
    revisions: string[];
  } {
    let confidence = 50;
    let completeness = 50;
    let quality = 50;
    const issues: string[] = [];
    const revisions: string[] = [];

    // Commit analysis
    if (commitCount >= 20) {
      completeness += 20;
      confidence += 15;
    } else if (commitCount >= 10) {
      completeness += 10;
      confidence += 5;
    } else if (commitCount > 0) {
      confidence -= 10;
      revisions.push('Increase commit frequency during milestone period');
    } else {
      issues.push('No commits found in milestone period');
      completeness -= 30;
      confidence -= 40;
    }

    // CI analysis
    if (ciStatus === 'success') {
      quality += 25;
      confidence += 10;
    } else if (ciStatus === 'failure') {
      issues.push('CI tests failing');
      quality -= 20;
      confidence -= 15;
      revisions.push('Fix failing CI tests');
    }

    // Demo analysis
    if (demoLive) {
      completeness += 15;
      quality += 10;
    } else {
      issues.push('Demo not accessible');
      completeness -= 15;
      revisions.push('Deploy working demo');
    }

    // README analysis
    if (readmeResult && readmeResult.success && readmeResult.data) {
      const readme = readmeResult.data as { content: string };
      if (readme.content.length > 200) {
        quality += 10;
      }
    }

    return {
      confidence: Math.min(100, Math.max(0, confidence)),
      completeness: Math.min(100, Math.max(0, completeness)),
      quality: Math.min(100, Math.max(0, quality)),
      issues,
      revisions,
    };
  }

  private determineRecommendation(
    scores: { confidence: number; completeness: number; quality: number },
    confidence: number,
  ): 'RELEASE_FUNDS' | 'REQUEST_REVISION' | 'REJECT' {
    if (scores.confidence >= 75 && scores.completeness >= 60 && scores.quality >= 50) {
      return 'RELEASE_FUNDS';
    }
    if (scores.confidence >= 50 && scores.completeness >= 40) {
      return 'REQUEST_REVISION';
    }
    return 'REJECT';
  }

  private generateReasoning(
    input: MilestoneValidationInput,
    scores: { confidence: number; completeness: number; quality: number; issues: string[]; revisions: string[] },
    recommendation: 'RELEASE_FUNDS' | 'REQUEST_REVISION' | 'REJECT',
    evidence: { commitCount: number; ciStatus: string; demoLive: boolean; poolHealthy: boolean },
  ): string {
    return `
# Milestone Validation Report

## Milestone Details
- ID: ${input.milestoneId}
- Idea: ${input.ideaId}
- Builder: ${input.builderAddress}
- Repository: ${input.repositoryUrl}
- Start Date: ${input.milestoneStartDate}
- Expected: ${input.expectedDeliverables}
- Claimed: ${input.claimedCompletion}

## Tool Evidence
- Commits: ${evidence.commitCount}
- CI Status: ${evidence.ciStatus}
- Demo Live: ${evidence.demoLive}
- Pool Healthy: ${evidence.poolHealthy}

## Scores
- Confidence: ${scores.confidence}/100
- Completeness: ${scores.completeness}/100
- Quality: ${scores.quality}/100

## Issues Found
${scores.issues.map((i) => `- ${i}`).join('\n') || 'None'}

## Required Revisions
${scores.revisions.map((r) => `- ${r}`).join('\n') || 'None'}

## Recommendation: ${recommendation}

## Reasoning
${recommendation === 'RELEASE_FUNDS' ? 'Milestone requirements met. Sufficient commits, passing CI, demo live.' : recommendation === 'REQUEST_REVISION' ? 'Milestone has gaps. Some requirements not met but fixable.' : 'Milestone rejected. Insufficient progress or critical issues.'}
    `.trim();
  }

  private hashInput(input: MilestoneValidationInput): string {
    const str = JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}