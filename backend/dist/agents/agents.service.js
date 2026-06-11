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
const AgentIdentity_1 = require("../blockchain/abi/AgentIdentity");
var AgentIdentity_2 = require("../blockchain/abi/AgentIdentity");
Object.defineProperty(exports, "DecisionType", { enumerable: true, get: function () { return AgentIdentity_2.DecisionType; } });
let AgentsService = AgentsService_1 = class AgentsService {
    constructor(toolsService, walletService, ipfsTools) {
        this.toolsService = toolsService;
        this.walletService = walletService;
        this.ipfsTools = ipfsTools;
        this.logger = new common_1.Logger(AgentsService_1.name);
        this.decisions = [];
    }
    async recordDecision(chain, agentIdentityAddress, decision) {
        let pinResult = await this.ipfsTools.pinReasoning(decision.reasoning, {
            agentType: decision.agentType,
            decisionType: decision.decisionType,
            subjectId: decision.subjectId,
            confidence: decision.confidence,
        });
        if (!pinResult.success || !pinResult.ipfsHash) {
            this.logger.warn('IPFS pin failed, using local mock hash for decision recording');
            const mockHash = `Qm${Math.random().toString(36).substring(2, 46)}`;
            pinResult = { success: true, ipfsHash: mockHash, pinUrl: `https://ipfs.io/ipfs/${mockHash}` };
        }
        const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const inputData = JSON.stringify({
            agentType: decision.agentType,
            decisionType: decision.decisionType,
            subjectId: decision.subjectId,
            timestamp: decision.timestamp.toISOString(),
        });
        const inputHash = this.walletService.hashInputForChain(inputData);
        const outputJson = JSON.stringify({
            confidence: decision.confidence,
            reasoning: decision.reasoning,
            toolResults: decision.toolResults,
        });
        const outputHash = this.walletService.hashOutputForChain(outputJson);
        let onChainResult = {
            txHash: '',
            blockNumber: 0,
            decisionIndex: -1,
        };
        try {
            onChainResult = await this.walletService.recordDecisionOnChain(chain, {
                decisionType: decision.decisionType,
                subjectId: parseInt(decision.subjectId, 10),
                inputHash,
                outputHash,
                confidence: decision.confidence,
                reasoningIpfsHash: pinResult.ipfsHash,
            });
            this.logger.log(`Decision recorded on-chain on ${chain}: ${onChainResult.txHash}`);
        }
        catch (error) {
            this.logger.warn(`Failed to record decision on-chain (will store locally): ${error}`);
            onChainResult.txHash = `local_${Date.now()}`;
        }
        this.decisions.push({
            ...decision,
            id: decisionId,
            reasoningIpfsHash: pinResult.ipfsHash,
            chain,
            onChainTxHash: onChainResult.txHash,
            onChainBlockNumber: onChainResult.blockNumber,
            onChainIndex: onChainResult.decisionIndex,
        });
        this.logger.log(`Decision recorded: ${decisionId} on ${chain}`);
        return {
            txHash: onChainResult.txHash,
            decisionId,
            onChainIndex: onChainResult.decisionIndex,
        };
    }
    async recordDecisionLocalOnly(decision) {
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
        return { decisionId };
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
            [AgentIdentity_1.DecisionType.IDEA_APPROVE]: 0,
            [AgentIdentity_1.DecisionType.IDEA_REJECT]: 0,
            [AgentIdentity_1.DecisionType.IDEA_RANK]: 0,
            [AgentIdentity_1.DecisionType.BUILDER_RANK]: 0,
            [AgentIdentity_1.DecisionType.MVP_VALIDATE]: 0,
            [AgentIdentity_1.DecisionType.MILESTONE_VALIDATE]: 0,
            [AgentIdentity_1.DecisionType.DAO_VOTE]: 0,
            [AgentIdentity_1.DecisionType.REVENUE_ADVICE]: 0,
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
            onChainCount: this.decisions.filter((d) => d.onChainTxHash && !d.onChainTxHash.startsWith('local_')).length,
        };
    }
    async syncWithOnChain(chain) {
        const localCount = this.decisions.filter((d) => d.chain === chain).length;
        let onChainCount = 0;
        try {
            onChainCount = await this.walletService.getOnChainDecisionCount(chain);
        }
        catch (error) {
            this.logger.error(`Failed to get on-chain count for ${chain}: ${error}`);
        }
        return {
            localCount,
            onChainCount,
            synced: localCount === onChainCount,
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