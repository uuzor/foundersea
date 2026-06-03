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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RankBuildersDto = exports.ValidateMilestoneDto = exports.ScoreIdeaDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class ScoreIdeaDto {
}
exports.ScoreIdeaDto = ScoreIdeaDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unique idea identifier' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "ideaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Idea title' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Detailed description' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Market category (e.g., DeFi, NFT, Gaming)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "marketCategory", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Demo URL if available' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "demoUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'GitHub repository URL' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "repositoryUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Creator wallet address' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "creatorAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Funding goal amount' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "fundingGoal", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Target chain (robinhood, mantle, base)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreIdeaDto.prototype, "chain", void 0);
class ValidateMilestoneDto {
}
exports.ValidateMilestoneDto = ValidateMilestoneDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unique milestone identifier' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "milestoneId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Parent idea ID' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "ideaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Builder wallet address' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "builderAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'GitHub repository URL' }),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "repositoryUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Demo URL if available' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "demoUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Milestone start date (ISO 8601)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "milestoneStartDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Expected deliverables' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "expectedDeliverables", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'What builder claims to have completed' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "claimedCompletion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Target chain (robinhood, mantle, base)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ValidateMilestoneDto.prototype, "chain", void 0);
class RankBuildersDto {
}
exports.RankBuildersDto = RankBuildersDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Parent idea ID' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RankBuildersDto.prototype, "ideaId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Builder wallet addresses' }),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], RankBuildersDto.prototype, "builderAddresses", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Builder GitHub portfolio URLs' }),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsUrl)({}, { each: true }),
    __metadata("design:type", Array)
], RankBuildersDto.prototype, "builderPortfolios", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Target chain (robinhood, mantle, base)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RankBuildersDto.prototype, "chain", void 0);
//# sourceMappingURL=agent.dto.js.map