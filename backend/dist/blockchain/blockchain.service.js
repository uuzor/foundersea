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
let BlockchainService = BlockchainService_1 = class BlockchainService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(BlockchainService_1.name);
        this.providers = new Map();
        this.initializeProviders();
    }
    initializeProviders() {
        this.providers.set('robinhood', new ethers_1.JsonRpcProvider(this.configService.robinhoodChainRpc));
        this.providers.set('mantle', new ethers_1.JsonRpcProvider(this.configService.mantleSepoliaRpc));
        this.providers.set('base', new ethers_1.JsonRpcProvider(this.configService.baseSepoliaRpc));
    }
    getProvider(chain) {
        const provider = this.providers.get(chain);
        if (!provider) {
            throw new Error(`Unsupported chain: ${chain}`);
        }
        return provider;
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
};
exports.BlockchainService = BlockchainService;
exports.BlockchainService = BlockchainService = BlockchainService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], BlockchainService);
//# sourceMappingURL=blockchain.service.js.map