import { ConfigService } from '../config/config.service';
export interface PinResult {
    success: boolean;
    ipfsHash?: string;
    pinUrl?: string;
    error?: string;
}
export declare class IpfsTools {
    private readonly configService;
    private readonly logger;
    private readonly pinataUrl;
    constructor(configService: ConfigService);
    pinReasoning(content: string, metadata?: Record<string, unknown>): Promise<PinResult>;
    getContent(ipfsHash: string): Promise<{
        success: boolean;
        content?: unknown;
        error?: string;
    }>;
}
