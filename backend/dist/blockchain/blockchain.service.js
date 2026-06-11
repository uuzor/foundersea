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
var BlockchainService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const ethers_1 = require("ethers");
const AgentIdentity_1 = require("./abi/AgentIdentity");
let BlockchainService = BlockchainService_1 = class BlockchainService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(BlockchainService_1.name);
        this.providers = new Map();
        this.contracts = new Map();
        this.initializeProviders();
        this.initializeContracts();
    }
    initializeProviders() {
        this.providers.set('mantle', new ethers_1.JsonRpcProvider(this.configService.mantleSepoliaRpc));
    }
    initializeContracts() {
        const address = this.getAgentIdentityAddress('mantle');
        if (!(0, ethers_1.isAddress)(address)) {
            this.logger.warn(`Skipping AgentIdentity init: invalid mantle address (${address || 'empty'})`);
            return;
        }
        const provider = this.providers.get('mantle');
        if (provider) {
            const contract = new ethers_1.Contract(address, AgentIdentity_1.AgentIdentityABI, provider);
            this.contracts.set('agentIdentity_mantle', contract);
            this.logger.log(`AgentIdentity contract initialized on mantle: ${address}`);
        }
    }
    getAgentIdentityAddress(chain) {
        return chain === 'mantle' ? this.configService.agentIdentityMantle : '';
    }
    getProvider(chain) {
        const provider = this.providers.get(chain);
        if (!provider) {
            throw new Error(`Unsupported chain: ${chain}. Only mantle is enabled.`);
        }
        return provider;
    }
    getContract(contractKey) {
        const contract = this.contracts.get(contractKey);
        if (!contract) {
            throw new Error(`Contract not found: ${contractKey}`);
        }
        return contract;
    }
    async getBlockNumber(chain) {
        const provider = this.getProvider(chain);
        return provider.getBlockNumber();
    }
    async getGasPrice(chain) {
        const provider = this.getProvider(chain);
        const feeData = await provider.getFeeData();
        return feeData.gasPrice?.toString() || '0';
    }
    async getOnChainDecisionCount(chain) {
        try {
            const contract = this.contracts.get(`agentIdentity_${chain}`);
            if (!contract) {
                throw new Error(`AgentIdentity not configured on ${chain}`);
            }
            return await contract.totalDecisions();
        }
        catch (error) {
            this.logger.error(`Failed to get decision count on ${chain}: ${error}`);
            return 0;
        }
    }
    async getOnChainDecision(chain, index) {
        try {
            const contract = this.contracts.get(`agentIdentity_${chain}`);
            if (!contract) {
                throw new Error(`AgentIdentity not configured on ${chain}`);
            }
            return await contract.getDecision(index);
        }
        catch (error) {
            this.logger.error(`Failed to get decision ${index} on ${chain}: ${error}`);
            return null;
        }
    }
};
exports.BlockchainService = BlockchainService;
exports.BlockchainService = BlockchainService = BlockchainService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], BlockchainService);
//# sourceMappingURL=blockchain.service.js.map