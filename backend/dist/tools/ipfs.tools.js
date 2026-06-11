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
var IpfsTools_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpfsTools = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
let IpfsTools = IpfsTools_1 = class IpfsTools {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(IpfsTools_1.name);
        this.pinataUrl = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
    }
    async pinReasoning(content, metadata = {}) {
        const apiKey = this.configService.pinataApiKey;
        const secret = this.configService.pinataSecret;
        if (!apiKey || !secret) {
            this.logger.warn('Pinata credentials not configured, returning mock hash');
            const mockHash = `Qm${Math.random().toString(36).substring(2, 46)}`;
            return {
                success: true,
                ipfsHash: mockHash,
                pinUrl: `https://ipfs.io/ipfs/${mockHash}`,
            };
        }
        try {
            const body = {
                pinataContent: {
                    content,
                    metadata,
                    timestamp: new Date().toISOString(),
                    version: '1.0',
                },
                pinataMetadata: {
                    name: `foundersea-reasoning-${Date.now()}`,
                    keyvalues: {
                        type: metadata.type || 'reasoning',
                        agent: metadata.agent || 'unknown',
                    },
                },
                pinataOptions: {
                    cidVersion: 1,
                },
            };
            const response = await fetch(this.pinataUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    pinata_api_key: apiKey,
                    pinata_secret_api_key: secret,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Pinata error: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            return {
                success: true,
                ipfsHash: data.IpfsHash,
                pinUrl: `https://ipfs.io/ipfs/${data.IpfsHash}`,
            };
        }
        catch (error) {
            this.logger.error('Failed to pin to IPFS', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async safePinReasoning(content, metadata = {}) {
        const result = await this.pinReasoning(content, metadata);
        if (result.success && result.ipfsHash)
            return result;
        this.logger.warn('IPFS pin failed, using local mock hash');
        const mockHash = `Qm${Math.random().toString(36).substring(2, 46)}`;
        return { success: true, ipfsHash: mockHash, pinUrl: `https://ipfs.io/ipfs/${mockHash}` };
    }
    async getContent(ipfsHash) {
        try {
            const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`, {
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) {
                throw new Error(`IPFS fetch error: ${response.status}`);
            }
            const content = await response.json();
            return {
                success: true,
                content,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get IPFS content: ${ipfsHash}`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
};
exports.IpfsTools = IpfsTools;
exports.IpfsTools = IpfsTools = IpfsTools_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], IpfsTools);
//# sourceMappingURL=ipfs.tools.js.map