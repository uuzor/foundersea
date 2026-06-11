"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RankBuildersDto = exports.ValidateMilestoneDto = exports.ScoreIdeaDto = exports.AgentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const agents_service_1 = require("./agents.service");
const idea_scorer_agent_1 = require("./idea-scorer.agent");
const milestone_validator_agent_1 = require("./milestone-validator.agent");
const builder_ranker_agent_1 = require("./builder-ranker.agent");
let AgentsController = class AgentsController {
    constructor(agentsService, ideaScorer, milestoneValidator, builderRanker) {
        this.agentsService = agentsService;
        this.ideaScorer = ideaScorer;
        this.milestoneValidator = milestoneValidator;
        this.builderRanker = builderRanker;
    }
    async scoreIdea(input) {
        return this.ideaScorer.scoreIdea(input);
    }
    async validateMilestone(input) {
        return this.milestoneValidator.validateMilestone(input);
    }
    async rankBuilders(input) {
        return this.builderRanker.rankBuilders(input);
    }
    getDecisions() {
        return this.agentsService.getAllDecisions().map((d) => ({
            id: d.id,
            agentType: d.agentType,
            decisionType: d.decisionType,
            subjectId: d.subjectId,
            confidence: d.confidence,
            executed: d.executed,
            timestamp: d.timestamp,
        }));
    }
    getDecision(id) {
        const decision = this.agentsService.getDecision(id);
        return {
            found: !!decision,
            decision,
        };
    }
    getDecisionsByType(type) {
        const decisionType = parseInt(type, 10);
        const decisions = this.agentsService.getDecisionsByType(decisionType);
        return {
            type,
            decisions,
            count: decisions.length,
        };
    }
    getDecisionsBySubject(subjectId) {
        const decisions = this.agentsService.getDecisionsBySubject(subjectId);
        return {
            subjectId,
            decisions,
            count: decisions.length,
        };
    }
    getStats() {
        return this.agentsService.getStats();
    }
    async testAgenticLoop(body) {
        const { TokenRouterService } = await Promise.resolve().then(() => __importStar(require('./token-router.service')));
        try {
            const tokenRouter = new TokenRouterService(null, null);
            return {
                success: true,
                finalResponse: 'Test endpoint - use /agentic/score-idea for full testing',
                toolCalls: [],
                iterations: 0,
            };
        }
        catch (error) {
            return {
                success: false,
                finalResponse: '',
                toolCalls: [],
                iterations: 0,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    getAvailableTools() {
        return {
            tools: [
                {
                    name: 'web_search',
                    description: 'Search the web for information about markets, competitors, etc.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' },
                            purpose: { type: 'string', description: 'Purpose of the search (market_research, competitor_check, etc.)' },
                        },
                        required: ['query'],
                    },
                },
                {
                    name: 'github_get_repo',
                    description: 'Get GitHub repository information (stars, description, activity)',
                    parameters: {
                        type: 'object',
                        properties: {
                            repo_url: { type: 'string', description: 'GitHub repository URL (e.g., https://github.com/owner/repo)' },
                        },
                        required: ['repo_url'],
                    },
                },
                {
                    name: 'url_fetch',
                    description: 'Fetch and analyze a URL (check availability, extract content)',
                    parameters: {
                        type: 'object',
                        properties: {
                            url: { type: 'string', description: 'URL to fetch' },
                            check_type: { type: 'string', description: 'Type of check (availability, content, screenshot)' },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'github_search',
                    description: 'Search GitHub for repositories matching a query',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' },
                            language: { type: 'string', description: 'Filter by programming language' },
                            limit: { type: 'number', description: 'Maximum number of results' },
                        },
                        required: ['query'],
                    },
                },
            ],
        };
    }
    async testIdeaScoring(input) {
        return {
            success: true,
            recommendation: 'ESCALATE',
            overallScore: 50,
            confidence: 50,
            reasoning: 'Test mode - set TOKENROUTER_API_KEY to enable real agentic scoring',
            toolCalls: [],
            iterations: 0,
        };
    }
};
exports.AgentsController = AgentsController;
__decorate([
    (0, common_1.Post)('ideas/score'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Score an idea using AI agent' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Idea scored successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid input' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentsController.prototype, "scoreIdea", null);
__decorate([
    (0, common_1.Post)('milestones/validate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Validate a milestone using AI agent' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Milestone validated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid input' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentsController.prototype, "validateMilestone", null);
__decorate([
    (0, common_1.Post)('builders/rank'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Rank builders using AI agent' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Builders ranked successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid input' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentsController.prototype, "rankBuilders", null);
__decorate([
    (0, common_1.Get)('decisions'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all AI agent decisions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Decisions retrieved successfully' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], AgentsController.prototype, "getDecisions", null);
__decorate([
    (0, common_1.Get)('decisions/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific decision by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Decision retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Decision not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], AgentsController.prototype, "getDecision", null);
__decorate([
    (0, common_1.Get)('decisions/type/:type'),
    (0, swagger_1.ApiOperation)({ summary: 'Get decisions by type' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Decisions retrieved successfully' }),
    __param(0, (0, common_1.Param)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], AgentsController.prototype, "getDecisionsByType", null);
__decorate([
    (0, common_1.Get)('decisions/subject/:subjectId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get decisions for a subject (idea, milestone, etc.)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Decisions retrieved successfully' }),
    __param(0, (0, common_1.Param)('subjectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], AgentsController.prototype, "getDecisionsBySubject", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get decision statistics' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Statistics retrieved successfully' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], AgentsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Post)('agentic/test'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Test the TokenRouter agentic loop with a custom prompt' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Agentic loop result' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid input' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentsController.prototype, "testAgenticLoop", null);
__decorate([
    (0, common_1.Get)('tools'),
    (0, swagger_1.ApiOperation)({ summary: 'Get available tools for agentic loop' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tools list' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], AgentsController.prototype, "getAvailableTools", null);
__decorate([
    (0, common_1.Post)('agentic/score-idea'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Test idea scoring via TokenRouter agentic loop' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Idea scored via agentic loop' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgentsController.prototype, "testIdeaScoring", null);
exports.AgentsController = AgentsController = __decorate([
    (0, swagger_1.ApiTags)('agents'),
    (0, common_1.Controller)('agents'),
    __metadata("design:paramtypes", [agents_service_1.AgentsService,
        idea_scorer_agent_1.IdeaScorerAgent,
        milestone_validator_agent_1.MilestoneValidatorAgent,
        builder_ranker_agent_1.BuilderRankerAgent])
], AgentsController);
class ScoreIdeaDto {
}
exports.ScoreIdeaDto = ScoreIdeaDto;
class ValidateMilestoneDto {
}
exports.ValidateMilestoneDto = ValidateMilestoneDto;
class RankBuildersDto {
}
exports.RankBuildersDto = RankBuildersDto;
//# sourceMappingURL=agents.controller.js.map