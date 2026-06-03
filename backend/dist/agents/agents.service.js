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
var AgentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentsService = exports.DecisionType = void 0;
const common_1 = require("@nestjs/common");
const tools_service_1 = require("../tools/tools.service");
const wallet_service_1 = require("../blockchain/wallet.service");
const ipfs_tools_1 = require("../tools/ipfs.tools");
var DecisionType;
(function (DecisionType) {
    DecisionType[DecisionType["IDEA_APPROVE"] = 0] = "IDEA_APPROVE";
    DecisionType[DecisionType["IDEA_REJECT"] = 1] = "IDEA_REJECT";
    DecisionType[DecisionType["IDEA_RANK"] = 2] = "IDEA_RANK";
    DecisionType[DecisionType["BUILDER_RANK"] = 3] = "BUILDER_RANK";
    DecisionType[DecisionType["MVP_VALIDATE"] = 4] = "MVP_VALIDATE";
    DecisionType[DecisionType["MILESTONE_VALIDATE"] = 5] = "MILESTONE_VALIDATE";
    DecisionType[DecisionType["DAO_VOTE"] = 6] = "DAO_VOTE";
    DecisionType[DecisionType["REVENUE_ADVICE"] = 7] = "REVENUE_ADVICE";
})(DecisionType || (exports.DecisionType = DecisionType = {}));
let AgentsService = AgentsService_1 = class AgentsService {
    constructor(toolsService, walletService, ipfsTools) {
        this.toolsService = toolsService;
        this.walletService = walletService;
        this.ipfsTools = ipfsTools;
        this.logger = new common_1.Logger(AgentsService_1.name);
        this.decisions = [];
    }
    async recordDecision(chain, agentIdentityAddress, decision) {
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
        this.decisions.push({
            ...decision,
            id: decisionId,
            reasoningIpfsHash: pinResult.ipfsHash,
        });
        this.logger.log(`Decision recorded: ${decisionId} on ${chain}`);
        return {
            txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
            decisionId,
        };
    }
    getDecision(decisionId) {
        return this.decisions.find((d) => d.id === decisionId);
    }
    getAllDecisions() {
        return this.decisions;
    }
    getDecisionsByType(decisionType) {
        return this.decisions.filter((d) => d.decisionType === decisionType);
    }
    getDecisionsBySubject(subjectId) {
        return this.decisions.filter((d) => d.subjectId === subjectId);
    }
    getAverageConfidence(decisionType) {
        const decisions = this.getDecisionsByType(decisionType);
        if (decisions.length === 0)
            return 0;
        const sum = decisions.reduce((acc, d) => acc + d.confidence, 0);
        return sum / decisions.length;
    }
    getStats() {
        const byType = {
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
        const avgConfidence = total > 0
            ? this.decisions.reduce((acc, d) => acc + d.confidence, 0) / total
            : 0;
        return {
            totalDecisions: total,
            byType,
            averageConfidence: avgConfidence,
            executedCount: this.decisions.filter((d) => d.executed).length,
        };
    }
};
exports.AgentsService = AgentsService;
exports.AgentsService = AgentsService = AgentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tools_service_1.ToolsService,
        wallet_service_1.WalletService,
        ipfs_tools_1.IpfsTools])
], AgentsService);
//# sourceMappingURL=agents.service.js.map