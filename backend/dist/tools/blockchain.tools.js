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
var BlockchainTools_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainTools = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const ethers_1 = require("ethers");
let BlockchainTools = BlockchainTools_1 = class BlockchainTools {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(BlockchainTools_1.name);
        this.providers = new Map();
        this.providers.set('robinhood', new ethers_1.JsonRpcProvider(this.configService.robinhoodChainRpc));
        this.providers.set('mantle', new ethers_1.JsonRpcProvider(this.configService.mantleSepoliaRpc));
        this.providers.set('base', new ethers_1.JsonRpcProvider(this.configService.baseSepoliaRpc));
    }
    getProvider(chain) {
        const provider = this.providers.get(chain);
        if (!provider) {
            throw new Error(`Unknown chain: ${chain}. Supported: robinhood, mantle, base`);
        }
        return provider;
    }
    async readContract(chain, contractAddress, method, args = []) {
        try {
            const provider = this.getProvider(chain);
            const code = await provider.getCode(contractAddress);
            if (code === '0x') {
                return {
                    success: false,
                    error: `No contract at address: ${contractAddress}`,
                };
            }
            const iface = new ethers_1.ethers.Interface([`function ${method}(${args.map(() => 'uint256').join(',')}) view returns (uint256)`]);
            const data = iface.encodeFunctionData(method, args);
            const result = await provider.call({ to: contractAddress, data });
            const decoded = iface.decodeFunctionResult(method, result);
            return {
                success: true,
                result: decoded[0].toString(),
            };
        }
        catch (error) {
            this.logger.error(`Failed to read contract: ${contractAddress}.${method}`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async getFundingPoolState(chain, ideaId) {
        let factoryAddress;
        switch (chain) {
            case 'mantle':
                factoryAddress = this.configService.ideaFactoryMantle;
                break;
            case 'base':
                factoryAddress = this.configService.ideaFactoryBase;
                break;
            case 'robinhood':
                factoryAddress = this.configService.ideaFactoryRHC;
                break;
            default:
                throw new Error(`Unknown chain: ${chain}`);
        }
        if (!factoryAddress) {
            throw new Error(`Factory not configured for chain: ${chain}`);
        }
        try {
            const provider = this.getProvider(chain);
            const factoryAbi = [
                'function fundingPools(uint256) view returns (address)',
            ];
            const factory = new ethers_1.Contract(factoryAddress, factoryAbi, provider);
            const fundingPoolAddress = await factory.fundingPools(parseInt(ideaId, 10));
            if (fundingPoolAddress === ethers_1.ethers.ZeroAddress) {
                throw new Error(`Funding pool not found for idea: ${ideaId}`);
            }
            const poolAbi = [
                'function raisedAmount() view returns (uint256)',
                'function softCap() view returns (uint256)',
                'function hardCap() view returns (uint256)',
                'function fundingClosed() view returns (bool)',
                'function builderAssigned() view returns (bool)',
                'function competitorsSet() view returns (bool)',
                'function getMilestoneCount() view returns (uint256)',
                'function competitorPayouts(uint256) view returns (address builder, uint256 amount, bool released, uint256 aiConfidence, string validationIpfsHash)',
            ];
            const pool = new ethers_1.Contract(fundingPoolAddress, poolAbi, provider);
            const [raisedAmount, softCap, hardCap, fundingClosed, builderAssigned, competitorsSet] = await Promise.all([
                pool.raisedAmount(),
                pool.softCap(),
                pool.hardCap(),
                pool.fundingClosed(),
                pool.builderAssigned(),
                pool.competitorsSet(),
            ]);
            const milestoneCount = await pool.getMilestoneCount();
            const milestones = [];
            for (let i = 0; i < Math.min(Number(milestoneCount), 10); i++) {
                milestones.push({
                    amount: '0',
                    released: false,
                    aiValidated: false,
                    aiConfidence: '0',
                });
            }
            const competitorPayouts = [];
            for (let i = 0; i < 3; i++) {
                try {
                    const payout = await pool.competitorPayouts(i);
                    competitorPayouts.push({
                        builder: payout[0],
                        amount: payout[1].toString(),
                        released: payout[2],
                        aiConfidence: payout[3].toString(),
                    });
                }
                catch {
                    competitorPayouts.push({
                        builder: ethers_1.ethers.ZeroAddress,
                        amount: '0',
                        released: false,
                        aiConfidence: '0',
                    });
                }
            }
            return {
                raisedAmount: raisedAmount.toString(),
                softCap: softCap.toString(),
                hardCap: hardCap.toString(),
                fundingClosed,
                builderAssigned,
                competitorsSet,
                milestones,
                competitorPayouts,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get funding pool state for idea: ${ideaId}`, error);
            throw error;
        }
    }
};
exports.BlockchainTools = BlockchainTools;
exports.BlockchainTools = BlockchainTools = BlockchainTools_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], BlockchainTools);
//# sourceMappingURL=blockchain.tools.js.map