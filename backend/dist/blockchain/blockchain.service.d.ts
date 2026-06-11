import { ConfigService } from '../config/config.service';
import { JsonRpcProvider, Contract } from 'ethers';
export interface OnChainDecision {
    txHash: string;
    blockNumber: number;
    decisionIndex: number;
}
export declare class BlockchainService {
    private readonly configService;
    private readonly logger;
    private providers;
    private contracts;
    constructor(configService: ConfigService);
    private initializeProviders;
    private initializeContracts;
    private getAgentIdentityAddress;
    getProvider(chain: string): JsonRpcProvider;
    getContract(contractKey: string): Contract;
    getBlockNumber(chain: string): Promise<number>;
    getGasPrice(chain: string): Promise<string>;
    getOnChainDecisionCount(chain: string): Promise<number>;
    getOnChainDecision(chain: string, index: number): Promise<any>;
}
