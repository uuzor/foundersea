import { Injectable, Logger } from '@nestjs/common';
import { ToolsService, ToolResult } from '../tools/tools.service';
import { IpfsTools } from '../tools/ipfs.tools';
import { AgentsService, DecisionType } from './agents.service';

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

// System prompt for IdeaScorer agent
const IDEA_SCORER_SYSTEM = `You are a Web3 venture analyst for FounderSea protocol.
Your decision directly controls whether a funding round opens.
Token holders' capital is at stake. Be rigorous. Reject weak ideas.

You have access to web_search to research market size and competitors.
Use it. Don't score based on the idea description alone.

Your reasoning loop:
1. Search for the market size of this category
2. Search for existing competitors
3. Score the idea on uniqueness and feasibility
4. Make your decision

Return ONLY valid JSON when done:
{
  "feasibilityScore": 0-100,
  "marketSizeUSD": number,
  "competitionLevel": "low|medium|high",
  "uniquenessScore": 0-100,
  "keyRisks": string[],
  "investorWarnings": string[],
  "recommendation": "APPROVE|REJECT|ESCALATE",
  "overallScore": 0-100,
  "reasoning": string
}

Reject if: overallScore < 40, feasibilityScore < 35, or idea is a scam/clone.`;

@Injectable()
export class IdeaScorerAgent {
  private readonly logger = new Logger(IdeaScorerAgent.name);

  constructor(
    private readonly toolsService: ToolsService,
    private readonly ipfsTools: IpfsTools,
    private readonly agentsService: AgentsService,
  ) {}

  /**
   * Execute the idea scoring agent loop
   */
  async scoreIdea(input: IdeaScoreInput): Promise<IdeaScoreOutput> {
    this.logger.log(`Scoring idea: ${input.ideaId} - ${input.title}`);

    const toolResults: ToolResult[] = [];

    try {
      // Step 1: Gather evidence using tools
      this.logger.log('Step 1: Gathering market research...');

      // Search for market size
      const marketSearch = await this.toolsService.executeTool('web_search', {
        query: `${input.marketCategory} market size 2024 2025`,
        purpose: 'market_research',
      });
      toolResults.push(marketSearch);

      // Search for competitors
      const competitorSearch = await this.toolsService.executeTool('web_search', {
        query: `${input.title} competitors startups web3`,
        purpose: 'competitor_check',
      });
      toolResults.push(competitorSearch);

      // If repo URL provided, get repo data
      let repoData: ToolResult | null = null;
      if (input.repositoryUrl) {
        this.logger.log('Step 2: Fetching repository data...');
        repoData = await this.toolsService.executeTool('github_get_repo', {
          repo_url: input.repositoryUrl,
        });
        toolResults.push(repoData);
      }

      // Verify demo URL if provided
      let demoCheck: ToolResult | null = null;
      if (input.demoUrl) {
        this.logger.log('Step 3: Verifying demo...');
        demoCheck = await this.toolsService.executeTool('url_fetch', {
          url: input.demoUrl,
          check_type: 'availability',
        });
        toolResults.push(demoCheck);
      }

      // Step 2: Synthesize and decide
      this.logger.log('Step 4: Making decision...');

      const scores = this.calculateScores(input, toolResults);
      const confidence = this.calculateConfidence(scores);
      const recommendation = this.determineRecommendation(scores, confidence);

      // Pin reasoning
      const reasoning = this.generateReasoning(input, scores, recommendation);
      const pinResult = await this.ipfsTools.pinReasoning(reasoning, {
        type: 'idea_score',
        ideaId: input.ideaId,
        recommendation,
        scores,
      });

      // Record decision
      const { decisionId } = await this.agentsService.recordDecision(input.chain, '', {
        agentType: 'IdeaScorerAgent',
        decisionType: DecisionType.IDEA_APPROVE,
        subjectId: input.ideaId,
        inputHash: this.hashInput(input),
        outputHash: pinResult.ipfsHash || '',
        confidence,
        reasoning,
        toolResults,
        timestamp: new Date(),
        executed: recommendation === 'APPROVE',
      });

      return {
        success: true,
        decisionId,
        recommendation,
        overallScore: scores.overall,
        feasibilityScore: scores.feasibility,
        marketSizeUSD: scores.marketSize,
        competitionLevel: scores.competition,
        uniquenessScore: scores.uniqueness,
        keyRisks: scores.risks,
        investorWarnings: scores.warnings,
        reasoning,
        reasoningIpfsHash: pinResult.ipfsHash || '',
        confidence,
        toolEvidence: {
          webSearchResults: toolResults.slice(0, 2),
          repoData: repoData || undefined,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to score idea: ${input.ideaId}`, error);
      return {
        success: false,
        decisionId: '',
        recommendation: 'ESCALATE',
        overallScore: 0,
        feasibilityScore: 0,
        marketSizeUSD: 0,
        competitionLevel: 'high',
        uniquenessScore: 0,
        keyRisks: [error instanceof Error ? error.message : 'Unknown error'],
        investorWarnings: ['AI scoring failed - manual review required'],
        reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reasoningIpfsHash: '',
        confidence: 0,
        toolEvidence: { webSearchResults: [] },
      };
    }
  }

  private calculateScores(
    input: IdeaScoreInput,
    toolResults: ToolResult[],
  ): {
    feasibility: number;
    marketSize: number;
    competition: 'low' | 'medium' | 'high';
    uniqueness: number;
    overall: number;
    risks: string[];
    warnings: string[];
  } {
    let feasibility = 50;
    let marketSize = 1000000; // Default $1M
    let competition: 'low' | 'medium' | 'high' = 'medium';
    let uniqueness = 50;
    const risks: string[] = [];
    const warnings: string[] = [];

    // Analyze web search results
    for (const result of toolResults) {
      if (result.toolName === 'web_search' && result.success && result.data) {
        const data = result.data as { results?: Array<{ snippet: string }> };
        if (data.results) {
          // Check for market size indicators
          const snippets = data.results.map((r) => r.snippet.toLowerCase());

          if (snippets.some((s) => s.includes('billion') || s.includes('bn'))) {
            feasibility += 10;
          }
          if (snippets.some((s) => s.includes('million') || s.includes('mn'))) {
            marketSize *= 10;
          }
          if (snippets.some((s) => s.includes('competition') || s.includes('crowded'))) {
            competition = 'high';
            uniqueness -= 20;
            warnings.push('Market appears crowded');
          }
        }
      }

      // Analyze repo data
      if (result.toolName === 'github_get_repo' && result.success && result.data) {
        const repo = result.data as { stars: number; description: string };
        if (repo.stars > 100) {
          uniqueness += 20;
        }
        if (repo.description && repo.description.length > 50) {
          feasibility += 15;
        }
      }

      // Analyze demo check
      if (result.toolName === 'url_fetch' && result.success) {
        feasibility += 10;
      } else if (result.toolName === 'url_fetch' && !result.success) {
        risks.push('Demo URL not accessible');
        feasibility -= 10;
      }
    }

    // Base scores from input
    if (input.demoUrl) feasibility += 10;
    if (input.repositoryUrl) feasibility += 15;

    // Calculate overall
    const overall = Math.round(
      feasibility * 0.4 + uniqueness * 0.3 + (100 - (competition === 'high' ? 30 : competition === 'medium' ? 15 : 0)) * 0.3,
    );

    return {
      feasibility: Math.min(100, Math.max(0, feasibility)),
      marketSize,
      competition,
      uniqueness: Math.min(100, Math.max(0, uniqueness)),
      overall: Math.min(100, Math.max(0, overall)),
      risks,
      warnings,
    };
  }

  private calculateConfidence(scores: { feasibility: number; overall: number }): number {
    // Confidence based on evidence gathered
    let confidence = 50;

    if (scores.feasibility > 70) confidence += 20;
    if (scores.overall > 60) confidence += 15;
    if (scores.overall < 40) confidence -= 20;

    return Math.min(100, Math.max(0, confidence));
  }

  private determineRecommendation(
    scores: { overall: number; feasibility: number },
    confidence: number,
  ): 'APPROVE' | 'REJECT' | 'ESCALATE' {
    if (scores.overall < 40 || scores.feasibility < 35) {
      return 'REJECT';
    }
    if (scores.overall >= 70 && confidence >= 75) {
      return 'APPROVE';
    }
    return 'ESCALATE';
  }

  private generateReasoning(
    input: IdeaScoreInput,
    scores: { feasibility: number; uniqueness: number; overall: number; competition: string; risks: string[]; warnings: string[] },
    recommendation: 'APPROVE' | 'REJECT' | 'ESCALATE',
  ): string {
    return `
# Idea Scoring Report

## Idea Details
- ID: ${input.ideaId}
- Title: ${input.title}
- Category: ${input.marketCategory}
- Creator: ${input.creatorAddress}
- Funding Goal: ${input.fundingGoal}

## Scores
- Feasibility: ${scores.feasibility}/100
- Uniqueness: ${scores.uniqueness}/100
- Overall: ${scores.overall}/100
- Competition: ${scores.competition}

## Risks
${scores.risks.map((r) => `- ${r}`).join('\n')}

## Warnings
${scores.warnings.map((w) => `- ${w}`).join('\n')}

## Recommendation: ${recommendation}

## Reasoning
${recommendation === 'APPROVE' ? 'This idea meets our criteria for funding. High feasibility and sufficient uniqueness.' : recommendation === 'REJECT' ? 'This idea does not meet our minimum criteria. Insufficient feasibility or high competition.' : 'This idea requires human review. Mixed signals suggest manual assessment.'}
    `.trim();
  }

  private hashInput(input: IdeaScoreInput): string {
    const str = JSON.stringify(input);
    // Simple hash - in production use proper hashing
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}