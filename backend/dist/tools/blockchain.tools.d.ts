import { ConfigService } from '../config/config.service';
export interface ContractReadResult {
    success: boolean;
    result?: unknown;
    error?: string;
}
export interface FundingPoolState {
    raisedAmount: string;
    softCap: string;
    hardCap: string;
    fundingClosed: boolean;
    builderAssigned: boolean;
    competitorsSet: boolean;
    milestones: Array<{
        amount: string;
        released: boolean;
        aiValidated: boolean;
        aiConfidence: string;
    }>;
    competitorPayouts: Array<{
        builder: string;
        amount: string;
        released: boolean;
        aiConfidence: string;
    }>;
}
export declare class BlockchainTools {
    private readonly configService;
    private readonly logger;
    private providers;
    constructor(configService: ConfigService);
    private getProvider;
    readContract(chain: string, contractAddress: string, method: string, args?: string[]): Promise<ContractReadResult>;
    getFundingPoolState(chain: string, ideaId: string): Promise<FundingPoolState>;
}
