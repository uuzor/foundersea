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
var BuilderRankerAgent_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuilderRankerAgent = void 0;
const common_1 = require("@nestjs/common");
const tools_service_1 = require("../tools/tools.service");
const ipfs_tools_1 = require("../tools/ipfs.tools");
const agents_service_1 = require("./agents.service");
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
let BuilderRankerAgent = BuilderRankerAgent_1 = class BuilderRankerAgent {
    constructor(toolsService, ipfsTools, agentsService) {
        this.toolsService = toolsService;
        this.ipfsTools = ipfsTools;
        this.agentsService = agentsService;
        this.logger = new common_1.Logger(BuilderRankerAgent_1.name);
    }
    async rankBuilders(input) {
        this.logger.log(`Ranking ${input.builderAddresses.length} builders for idea: ${input.ideaId}`);
        const toolResults = [];
        const builderData = new Map();
        try {
            for (let i = 0; i < input.builderAddresses.length; i++) {
                const address = input.builderAddresses[i];
                const portfolio = input.builderPortfolios[i];
                const data = {};
                if (portfolio) {
                    try {
                        data.repoData = await this.toolsService.executeTool('github_get_repo', {
                            repo_url: portfolio,
                        });
                        toolResults.push(data.repoData);
                    }
                    catch {
                        this.logger.warn(`Could not fetch repo for ${address}`);
                    }
                    const ninetyDaysAgo = new Date();
                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                    try {
                        data.recentCommits = await this.toolsService.executeTool('github_get_commits', {
                            repo_url: portfolio,
                            since_date: ninetyDaysAgo.toISOString(),
                        });
                        toolResults.push(data.recentCommits);
                    }
                    catch {
                        this.logger.warn(`Could not fetch commits for ${address}`);
                    }
                }
                try {
                    data.webSearch = await this.toolsService.executeTool('web_search', {
                        query: `web3 developer ${address}`,
                        purpose: 'general',
                    });
                    toolResults.push(data.webSearch);
                }
                catch {
                    this.logger.warn(`Could not search for ${address}`);
                }
                builderData.set(address, data);
            }
            this.logger.log('Calculating builder scores...');
            const rankings = this.calculateRankings(input, builderData);
            const topPick = rankings.find((r) => r.shortlistRecommend) || rankings[0];
            const mergerCandidates = this.findMergerCandidates(rankings);
            const reasoning = this.generateReasoning(input, rankings, topPick, mergerCandidates);
            const pinResult = await this.ipfsTools.pinReasoning(reasoning, {
                type: 'builder_ranking',
                ideaId: input.ideaId,
                builderCount: input.builderAddresses.length,
            });
            const { decisionId } = await this.agentsService.recordDecision(input.chain, '', {
                agentType: 'BuilderRankerAgent',
                decisionType: agents_service_1.DecisionType.BUILDER_RANK,
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
        }
        catch (error) {
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
    calculateRankings(input, builderData) {
        return input.builderAddresses.map((address) => {
            const data = builderData.get(address) || {};
            let technicalScore = 50;
            let deliveryScore = 50;
            const reasoningParts = [];
            if (data.repoData?.success && data.repoData.data) {
                const repo = data.repoData.data;
                if (repo.stars > 100) {
                    technicalScore += 20;
                    reasoningParts.push(`Strong portfolio: ${repo.stars} stars`);
                }
                else if (repo.stars > 10) {
                    technicalScore += 10;
                }
                if (repo.language) {
                    reasoningParts.push(`Primary language: ${repo.language}`);
                }
                if (repo.lastCommitDate) {
                    const lastCommit = new Date(repo.lastCommitDate);
                    const daysSince = (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSince < 7) {
                        deliveryScore += 15;
                        reasoningParts.push('Recent activity (last 7 days)');
                    }
                    else if (daysSince < 30) {
                        deliveryScore += 5;
                    }
                }
            }
            if (data.recentCommits?.success && data.recentCommits.data) {
                const commits = data.recentCommits.data;
                const commitCount = commits.length;
                if (commitCount > 50) {
                    deliveryScore += 20;
                    reasoningParts.push(`${commitCount} commits in last 90 days`);
                }
                else if (commitCount > 20) {
                    deliveryScore += 10;
                }
            }
            if (data.webSearch?.success && data.webSearch.data) {
                const searchData = data.webSearch.data;
                if (searchData.results && searchData.results.length > 0) {
                    deliveryScore += 5;
                    reasoningParts.push('Verified web3 track record');
                }
            }
            const overallScore = Math.round(technicalScore * 0.5 + deliveryScore * 0.4 + 50 * 0.1);
            return {
                address,
                overallScore: Math.min(100, overallScore),
                deliveryScore: Math.min(100, deliveryScore),
                technicalScore: Math.min(100, technicalScore),
                proposalScore: 50,
                shortlistRecommend: overallScore >= 60 && deliveryScore >= 40,
                reasoning: reasoningParts.length > 0 ? reasoningParts.join('. ') : 'Limited data available',
            };
        }).sort((a, b) => b.overallScore - a.overallScore);
    }
    findMergerCandidates(rankings) {
        const shortlist = rankings.filter((r) => r.shortlistRecommend);
        if (shortlist.length >= 2) {
            return [shortlist[0].address, shortlist[1].address];
        }
        return null;
    }
    calculateConfidence(rankings) {
        if (rankings.length === 0)
            return 0;
        const avg = rankings.reduce((sum, r) => sum + r.overallScore, 0) / rankings.length;
        const range = Math.max(...rankings.map((r) => r.overallScore)) - Math.min(...rankings.map((r) => r.overallScore));
        if (range > 30)
            return 80;
        if (range > 15)
            return 70;
        return 60;
    }
    generateSummary(rankings) {
        const top = rankings[0];
        const shortlistCount = rankings.filter((r) => r.shortlistRecommend).length;
        return `Analyzed ${rankings.length} builders. ${shortlistCount} recommended for shortlist. Top pick: ${top?.address?.substring(0, 10)}... with score ${top?.overallScore}/100.`;
    }
    generateReasoning(input, rankings, topPick, mergerCandidates) {
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
exports.BuilderRankerAgent = BuilderRankerAgent;
exports.BuilderRankerAgent = BuilderRankerAgent = BuilderRankerAgent_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tools_service_1.ToolsService,
        ipfs_tools_1.IpfsTools,
        agents_service_1.AgentsService])
], BuilderRankerAgent);
//# sourceMappingURL=builder-ranker.agent.js.map