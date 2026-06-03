import { Injectable, Logger } from '@nestjs/common';
import { ToolsService, ToolResult } from '../tools/tools.service';
import { IpfsTools } from '../tools/ipfs.tools';
import { AgentsService, DecisionType } from './agents.service';

export interface BuilderRankingInput {
  ideaId: string;
  builderAddresses: string[];
  builderPortfolios: string[]; // GitHub repo URLs
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

// System prompt for BuilderRanker agent
const BUILDER_RANKER_SYSTEM = `You are evaluating builder applicants for a funded Web3 project.
Their livelihoods may depend on getting this right. Be thorough.

For each applicant:
1. github_get_repo(portfolio_url) — assess code quality and activity
2. github_get_commits(portfolio_url, last_90_days) — verify recent activity
3. web_search(builder_name + "web3", "general") — verify public track record

Then rank all applicants and return ONLY valid JSON:
{
  "rankings": [{
    "address": string,
    "overallScore": 0-100,
    "deliveryScore": 0-100,
    "technicalScore": 0-100,
    "proposalScore": 0-100,
    "shortlistRecommend": boolean,
    "reasoning": string,
    "githubEvidence": { "commitCount": number, "repoStars": number, "languages": string[] }
  }],
  "topPickAddress": string,
  "mergerCandidates": [string, string] | null,
  "summary": string
}`;

@Injectable()
export class BuilderRankerAgent {
  private readonly logger = new Logger(BuilderRankerAgent.name);

  constructor(
    private readonly toolsService: ToolsService,
    private readonly ipfsTools: IpfsTools,
    private readonly agentsService: AgentsService,
  ) {}

  /**
   * Execute the builder ranking agent loop
   */
  async rankBuilders(input: BuilderRankingInput): Promise<BuilderRankingOutput> {
    this.logger.log(`Ranking ${input.builderAddresses.length} builders for idea: ${input.ideaId}`);

    const toolResults: ToolResult[] = [];
    const builderData: Map<string, {
      repoData?: ToolResult;
      recentCommits?: ToolResult;
      webSearch?: ToolResult;
    }> = new Map();

    try {
      // Gather data for each builder
      for (let i = 0; i < input.builderAddresses.length; i++) {
        const address = input.builderAddresses[i];
        const portfolio = input.builderPortfolios[i];
        const data: { repoData?: ToolResult; recentCommits?: ToolResult; webSearch?: ToolResult } = {};

        // Get repo data
        if (portfolio) {
          try {
            data.repoData = await this.toolsService.executeTool('github_get_repo', {
              repo_url: portfolio,
            });
            toolResults.push(data.repoData);
          } catch {
            this.logger.warn(`Could not fetch repo for ${address}`);
          }

          // Get recent commits
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

          try {
            data.recentCommits = await this.toolsService.executeTool('github_get_commits', {
              repo_url: portfolio,
              since_date: ninetyDaysAgo.toISOString(),
            });
            toolResults.push(data.recentCommits);
          } catch {
            this.logger.warn(`Could not fetch commits for ${address}`);
          }
        }

        // Web search for track record
        try {
          data.webSearch = await this.toolsService.executeTool('web_search', {
            query: `web3 developer ${address}`,
            purpose: 'general',
          });
          toolResults.push(data.webSearch);
        } catch {
          this.logger.warn(`Could not search for ${address}`);
        }

        builderData.set(address, data);
      }

      // Calculate scores
      this.logger.log('Calculating builder scores...');
      const rankings = this.calculateRankings(input, builderData);
      const topPick = rankings.find((r) => r.shortlistRecommend) || rankings[0];
      const mergerCandidates = this.findMergerCandidates(rankings);

      // Pin reasoning
      const reasoning = this.generateReasoning(input, rankings, topPick, mergerCandidates);
      const pinResult = await this.ipfsTools.pinReasoning(reasoning, {
        type: 'builder_ranking',
        ideaId: input.ideaId,
        builderCount: input.builderAddresses.length,
      });

      // Record decision
      const { decisionId } = await this.agentsService.recordDecision(input.chain, '', {
        agentType: 'BuilderRankerAgent',
        decisionType: DecisionType.BUILDER_RANK,
        subjectId: input.ideaId,
        inputHash: this.hashInput(input),
        outputHash: pinResult.ipfsHash || '',
        confidence: this.calculateConfidence(rankings),
        reasoning,
        toolResults,
        timestamp: new Date(),
        executed: false,
      });

      return {
        success: true,
        decisionId,
        rankings,
        topPickAddress: topPick?.address || '',
        mergerCandidates,
        summary: this.generateSummary(rankings),
        reasoningIpfsHash: pinResult.ipfsHash || '',
      };
    } catch (error) {
      this.logger.error(`Failed to rank builders for idea: ${input.ideaId}`, error);
      return {
        success: false,
        decisionId: '',
        rankings: input.builderAddresses.map((address) => ({
          address,
          overallScore: 0,
          deliveryScore: 0,
          technicalScore: 0,
          proposalScore: 0,
          shortlistRecommend: false,
          reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })),
        topPickAddress: '',
        mergerCandidates: null,
        summary: 'Builder ranking failed - manual review required',
        reasoningIpfsHash: '',
      };
    }
  }

  private calculateRankings(
    input: BuilderRankingInput,
    builderData: Map<string, { repoData?: ToolResult; recentCommits?: ToolResult; webSearch?: ToolResult }>,
  ): Array<{
    address: string;
    overallScore: number;
    deliveryScore: number;
    technicalScore: number;
    proposalScore: number;
    shortlistRecommend: boolean;
    reasoning: string;
  }> {
    return input.builderAddresses.map((address) => {
      const data = builderData.get(address) || {};
      let technicalScore = 50;
      let deliveryScore = 50;
      const reasoningParts: string[] = [];

      // Analyze repo data
      if (data.repoData?.success && data.repoData.data) {
        const repo = data.repoData.data as { stars: number; language: string | null; lastCommitDate: string };

        // Technical score from stars and activity
        if (repo.stars > 100) {
          technicalScore += 20;
          reasoningParts.push(`Strong portfolio: ${repo.stars} stars`);
        } else if (repo.stars > 10) {
          technicalScore += 10;
        }

        if (repo.language) {
          reasoningParts.push(`Primary language: ${repo.language}`);
        }

        // Check recent activity
        if (repo.lastCommitDate) {
          const lastCommit = new Date(repo.lastCommitDate);
          const daysSince = (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 7) {
            deliveryScore += 15;
            reasoningParts.push('Recent activity (last 7 days)');
          } else if (daysSince < 30) {
            deliveryScore += 5;
          }
        }
      }

      // Analyze commit count
      if (data.recentCommits?.success && data.recentCommits.data) {
        const commits = data.recentCommits.data as Array<unknown>;
        const commitCount = commits.length;

        if (commitCount > 50) {
          deliveryScore += 20;
          reasoningParts.push(`${commitCount} commits in last 90 days`);
        } else if (commitCount > 20) {
          deliveryScore += 10;
        }
      }

      // Analyze web presence
      if (data.webSearch?.success && data.webSearch.data) {
        const searchData = data.webSearch.data as { results?: Array<unknown> };
        if (searchData.results && searchData.results.length > 0) {
          deliveryScore += 5;
          reasoningParts.push('Verified web3 track record');
        }
      }

      // Calculate overall
      const overallScore = Math.round(technicalScore * 0.5 + deliveryScore * 0.4 + 50 * 0.1);

      return {
        address,
        overallScore: Math.min(100, overallScore),
        deliveryScore: Math.min(100, deliveryScore),
        technicalScore: Math.min(100, technicalScore),
        proposalScore: 50, // Would come from additional input
        shortlistRecommend: overallScore >= 60 && deliveryScore >= 40,
        reasoning: reasoningParts.length > 0 ? reasoningParts.join('. ') : 'Limited data available',
      };
    }).sort((a, b) => b.overallScore - a.overallScore);
  }

  private findMergerCandidates(
    rankings: Array<{ address: string; overallScore: number; shortlistRecommend: boolean }>,
  ): [string, string] | null {
    const shortlist = rankings.filter((r) => r.shortlistRecommend);
    if (shortlist.length >= 2) {
      // Return top 2 for potential merger
      return [shortlist[0].address, shortlist[1].address];
    }
    return null;
  }

  private calculateConfidence(
    rankings: Array<{ overallScore: number }>,
  ): number {
    if (rankings.length === 0) return 0;

    const avg = rankings.reduce((sum, r) => sum + r.overallScore, 0) / rankings.length;
    const range = Math.max(...rankings.map((r) => r.overallScore)) - Math.min(...rankings.map((r) => r.overallScore));

    // Higher confidence if clear winner and clear differentiation
    if (range > 30) return 80;
    if (range > 15) return 70;
    return 60;
  }

  private generateSummary(
    rankings: Array<{ address: string; overallScore: number; shortlistRecommend: boolean }>,
  ): string {
    const top = rankings[0];
    const shortlistCount = rankings.filter((r) => r.shortlistRecommend).length;

    return `Analyzed ${rankings.length} builders. ${shortlistCount} recommended for shortlist. Top pick: ${top?.address?.substring(0, 10)}... with score ${top?.overallScore}/100.`;
  }

  private generateReasoning(
    input: BuilderRankingInput,
    rankings: Array<{ address: string; overallScore: number; shortlistRecommend: boolean; reasoning: string }>,
    topPick: { address: string; overallScore: number } | undefined,
    mergerCandidates: [string, string] | null,
  ): string {
    return `
# Builder Ranking Report

## Idea: ${input.ideaId}
## Total Builders: ${input.builderAddresses.length}

## Rankings
${rankings.map((r, i) => `${i + 1}. ${r.address} - Score: ${r.overallScore}/100 - ${r.reasoning}`).join('\n')}

## Top Pick
${topPick?.address} (Score: ${topPick?.overallScore}/100)

${mergerCandidates ? `## Merger Candidates\n${mergerCandidates[0]} + ${mergerCandidates[1]}` : '## No Merger Candidates'}

## Summary
${this.generateSummary(rankings)}
    `.trim();
  }

  private hashInput(input: BuilderRankingInput): string {
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