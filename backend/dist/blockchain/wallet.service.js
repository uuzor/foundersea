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
let WalletService = WalletService_1 = class WalletService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(WalletService_1.name);
        this.wallet = null;
        this.providers = new Map();
        this.initializeWallet();
        this.initializeProviders();
    }
    initializeWallet() {
        const privateKey = this.configService.aiAgentPrivateKey;
        if (privateKey) {
            this.wallet = new ethers_1.Wallet(privateKey);
            this.logger.log(`AI Agent wallet initialized: ${this.wallet.address}`);
        }
        else {
            this.logger.warn('AI Agent private key not configured - wallet operations disabled');
        }
    }
    initializeProviders() {
        this.providers.set('robinhood', new ethers_1.JsonRpcProvider(this.configService.robinhoodChainRpc));
        this.providers.set('mantle', new ethers_1.JsonRpcProvider(this.configService.mantleSepoliaRpc));
        this.providers.set('base', new ethers_1.JsonRpcProvider(this.configService.baseSepoliaRpc));
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
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = WalletService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map