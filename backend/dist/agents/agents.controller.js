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