"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var IdeaScorerAgent_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdeaScorerAgent = void 0;
const common_1 = require("@nestjs/common");
const tools_service_1 = require("../tools/tools.service");
const ipfs_tools_1 = require("../tools/ipfs.tools");
const agents_service_1 = require("./agents.service");
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
let IdeaScorerAgent = IdeaScorerAgent_1 = class IdeaScorerAgent {
    constructor(toolsService, ipfsTools, agentsService) {
        this.toolsService = toolsService;
        this.ipfsTools = ipfsTools;
        this.agentsService = agentsService;
        this.logger = new common_1.Logger(IdeaScorerAgent_1.name);
    }
    async scoreIdea(input) {
        this.logger.log(`Scoring idea: ${input.ideaId} - ${input.title}`);
        const toolResults = [];
        try {
            this.logger.log('Step 1: Gathering market research...');
            const marketSearch = await this.toolsService.executeTool('web_search', {
                query: `${input.marketCategory} market size 2024 2025`,
                purpose: 'market_research',
            });
            toolResults.push(marketSearch);
            const competitorSearch = await this.toolsService.executeTool('web_search', {
                query: `${input.title} competitors startups web3`,
                purpose: 'competitor_check',
            });
            toolResults.push(competitorSearch);
            let repoData = null;
            if (input.repositoryUrl) {
                this.logger.log('Step 2: Fetching repository data...');
                repoData = await this.toolsService.executeTool('github_get_repo', {
                    repo_url: input.repositoryUrl,
                });
                toolResults.push(repoData);
            }
            let demoCheck = null;
            if (input.demoUrl) {
                this.logger.log('Step 3: Verifying demo...');
                demoCheck = await this.toolsService.executeTool('url_fetch', {
                    url: input.demoUrl,
                    check_type: 'availability',
                });
                toolResults.push(demoCheck);
            }
            this.logger.log('Step 4: Making decision...');
            const scores = this.calculateScores(input, toolResults);
            const confidence = this.calculateConfidence(scores);
            const recommendation = this.determineRecommendation(scores, confidence);
            const reasoning = this.generateReasoning(input, scores, recommendation);
            const pinResult = await this.ipfsTools.safePinReasoning(reasoning, {
                type: 'idea_score',
                ideaId: input.ideaId,
                recommendation,
                scores,
            });
            const { decisionId } = await this.agentsService.recordDecision(input.chain, '', {
                agentType: 'IdeaScorerAgent',
                decisionType: agents_service_1.DecisionType.IDEA_APPROVE,
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
        }
        catch (error) {
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
    calculateScores(input, toolResults) {
        let feasibility = 50;
        let marketSize = 1000000;
        let competition = 'medium';
        let uniqueness = 50;
        const risks = [];
        const warnings = [];
        for (const result of toolResults) {
            if (result.toolName === 'web_search' && result.success && result.data) {
                const data = result.data;
                if (data.results) {
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
            if (result.toolName === 'github_get_repo' && result.success && result.data) {
                const repo = result.data;
                if (repo.stars > 100) {
                    uniqueness += 20;
                }
                if (repo.description && repo.description.length > 50) {
                    feasibility += 15;
                }
            }
            if (result.toolName === 'url_fetch' && result.success) {
                feasibility += 10;
            }
            else if (result.toolName === 'url_fetch' && !result.success) {
                risks.push('Demo URL not accessible');
                feasibility -= 10;
            }
        }
        if (input.demoUrl)
            feasibility += 10;
        if (input.repositoryUrl)
            feasibility += 15;
        const overall = Math.round(feasibility * 0.4 + uniqueness * 0.3 + (100 - (competition === 'high' ? 30 : competition === 'medium' ? 15 : 0)) * 0.3);
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
    calculateConfidence(scores) {
        let confidence = 50;
        if (scores.feasibility > 70)
            confidence += 20;
        if (scores.overall > 60)
            confidence += 15;
        if (scores.overall < 40)
            confidence -= 20;
        return Math.min(100, Math.max(0, confidence));
    }
    determineRecommendation(scores, confidence) {
        if (scores.overall < 40 || scores.feasibility < 35) {
            return 'REJECT';
        }
        if (scores.overall >= 70 && confidence >= 75) {
            return 'APPROVE';
        }
        return 'ESCALATE';
    }
    generateReasoning(input, scores, recommendation) {
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
    hashInput(input) {
        const str = JSON.stringify(input);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
};
exports.IdeaScorerAgent = IdeaScorerAgent;
exports.IdeaScorerAgent = IdeaScorerAgent = IdeaScorerAgent_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tools_service_1.ToolsService,
        ipfs_tools_1.IpfsTools,
        agents_service_1.AgentsService])
], IdeaScorerAgent);
//# sourceMappingURL=idea-scorer.agent.js.map