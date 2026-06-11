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
var WalletService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const ethers_1 = require("ethers");
const AgentIdentity_1 = require("./abi/AgentIdentity");
let WalletService = WalletService_1 = class WalletService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(WalletService_1.name);
        this.wallet = null;
        this.providers = new Map();
        this.contracts = new Map();
        this.initializeWallet();
        this.initializeProviders();
        this.initializeContracts();
    }
    initializeWallet() {
        const privateKey = this.configService.aiAgentPrivateKey;
        if (privateKey && privateKey !== '0x_your_private_key_here' && (0, ethers_1.isHexString)(privateKey, 32)) {
            this.wallet = new ethers_1.Wallet(privateKey);
            this.logger.log(`AI Agent wallet initialized: ${this.wallet.address}`);
        }
        else {
            this.logger.warn('AI Agent private key not configured or invalid - wallet operations disabled');
        }
    }
    initializeProviders() {
        this.providers.set('mantle', new ethers_1.JsonRpcProvider(this.configService.mantleSepoliaRpc));
    }
    initializeContracts() {
        const chains = ['mantle'];
        chains.forEach((chain) => {
            const address = this.getAgentIdentityAddress(chain);
            if (address) {
                const provider = this.providers.get(chain);
                if (provider) {
                    const signer = this.wallet ? this.wallet.connect(provider) : provider;
                    const contract = new ethers_1.Contract(address, AgentIdentity_1.AgentIdentityABI, signer);
                    this.contracts.set(`agentIdentity_${chain}`, contract);
                    this.logger.log(`AgentIdentity contract initialized on ${chain}: ${address}`);
                }
            }
        });
    }
    getAgentIdentityAddress(chain) {
        return chain === 'mantle' ? this.configService.agentIdentityMantle : '';
    }
    getAddress() {
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }
        return this.wallet.address;
    }
    async getBalance(chain) {
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }
        const provider = this.providers.get(chain);
        if (!provider) {
            throw new Error(`Unsupported chain: ${chain}`);
        }
        const balance = await provider.getBalance(this.wallet.address);
        return ethers_1.ethers.formatEther(balance);
    }
    async sendTransaction(chain, to, value, data) {
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }
        const provider = this.providers.get(chain);
        if (!provider) {
            throw new Error(`Unsupported chain: ${chain}`);
        }
        const signer = this.wallet.connect(provider);
        const tx = await signer.sendTransaction({
            to,
            value: ethers_1.ethers.parseEther(value),
            data: data || '0x',
        });
        this.logger.log(`Transaction sent on ${chain}: ${tx.hash}`);
        return tx;
    }
    async signMessage(message) {
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }
        return this.wallet.signMessage(message);
    }
    async signTypedData(domain, types, message) {
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }
        return this.wallet.signMessage(JSON.stringify(message));
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
    async recordDecisionOnChain(chain, params) {
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }
        const contract = this.contracts.get(`agentIdentity_${chain}`);
        if (!contract) {
            throw new Error(`AgentIdentity not configured on ${chain}`);
        }
        const decisionCountBefore = await contract.totalDecisions();
        this.logger.log(`Recording decision on ${chain}: type=${params.decisionType}, subject=${params.subjectId}, confidence=${params.confidence}`);
        try {
            const tx = await contract.recordDecision(params.decisionType, params.subjectId, params.inputHash, params.outputHash, params.confidence, params.reasoningIpfsHash);
            const receipt = await tx.wait();
            const blockNumber = receipt.blockNumber;
            const txHash = receipt.hash;
            const decisionIndex = Number(decisionCountBefore);
            this.logger.log(`Decision recorded on ${chain}: tx=${txHash}, block=${blockNumber}, index=${decisionIndex}`);
            return {
                txHash,
                blockNumber,
                decisionIndex,
            };
        }
        catch (error) {
            this.logger.error(`Failed to record decision on ${chain}: ${error}`);
            throw error;
        }
    }
    hashInputForChain(data) {
        const encoded = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(data));
        return encoded;
    }
    hashOutputForChain(outputJson) {
        const encoded = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(outputJson));
        return encoded;
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = WalletService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map