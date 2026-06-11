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
exports.ConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ConfigService = class ConfigService {
    constructor(configService) {
        this.configService = configService;
    }
    get tokenRouterApiKey() {
        return this.configService.get('TOKENROUTER_API_KEY', '');
    }
    get tokenRouterBaseUrl() {
        return this.configService.get('TOKENROUTER_BASE_URL', 'https://api.tokenrouter.io/v1');
    }
    get githubToken() {
        return this.configService.get('GITHUB_TOKEN', '');
    }
    get serperApiKey() {
        return this.configService.get('SERPER_API_KEY', '');
    }
    get pinataApiKey() {
        return this.configService.get('PINATA_API_KEY', '');
    }
    get pinataSecret() {
        return this.configService.get('PINATA_SECRET', '');
    }
    get robinhoodChainRpc() {
        return this.configService.get('ROBINHOOD_CHAIN_RPC', 'https://testnet.rpc.robinhood.com');
    }
    get mantleSepoliaRpc() {
        return this.configService.get('MANTLE_SEPOLIA_RPC', 'https://rpc.sepolia.mantle.xyz');
    }
    get baseSepoliaRpc() {
        return this.configService.get('BASE_SEPOLIA_RPC', 'https://sepolia.base.org');
    }
    get mantleRpc() {
        return this.configService.get('MANTLE_SEPOLIA_RPC', 'https://rpc.sepolia.mantle.xyz');
    }
    get aiAgentPrivateKey() {
        return this.configService.get('AI_AGENT_PRIVATE_KEY', '');
    }
    get ideaFactoryMantle() {
        return this.configService.get('IDEA_FACTORY_MANTLE', '');
    }
    get agentIdentityMantle() {
        return this.configService.get('AGENT_IDENTITY_MANTLE', '');
    }
    get daoVotingMantle() {
        return this.configService.get('DAO_VOTING_MANTLE', '');
    }
    get ideaMarketplaceMantle() {
        return this.configService.get('IDEA_MARKETPLACE_MANTLE', '');
    }
    get ideaFactoryBase() {
        return this.configService.get('IDEA_FACTORY_BASE', '');
    }
    get agentIdentityBase() {
        return this.configService.get('AGENT_IDENTITY_BASE', '');
    }
    get daoVotingBase() {
        return this.configService.get('DAO_VOTING_BASE', '');
    }
    get ideaMarketplaceBase() {
        return this.configService.get('IDEA_MARKETPLACE_BASE', '');
    }
    get ideaFactoryRHC() {
        return this.configService.get('IDEA_FACTORY_RHC', '');
    }
    get agentIdentityRHC() {
        return this.configService.get('AGENT_IDENTITY_RHC', '');
    }
    get daoVotingRHC() {
        return this.configService.get('DAO_VOTING_RHC', '');
    }
    get ideaMarketplaceRHC() {
        return this.configService.get('IDEA_MARKETPLACE_RHC', '');
    }
    get usdyMantle() {
        return this.configService.get('USDY_MANTLE', '');
    }
    get usdyBase() {
        return this.configService.get('USDY_BASE', '');
    }
    get webhookBaseUrl() {
        return this.configService.get('WEBHOOK_BASE_URL', '');
    }
    get port() {
        return parseInt(this.configService.get('PORT', '3000'), 10);
    }
};
exports.ConfigService = ConfigService;
exports.ConfigService = ConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ConfigService);
//# sourceMappingURL=config.service.js.map