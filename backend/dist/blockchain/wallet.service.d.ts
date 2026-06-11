import { ConfigService } from '../config/config.service';
import { TransactionResponse } from 'ethers';
import { DecisionType } from './abi/AgentIdentity';
export interface RecordDecisionParams {
    decisionType: DecisionType;
    subjectId: number;
    inputHash: string;
    outputHash: string;
    confidence: number;
    reasoningIpfsHash: string;
}
export interface RecordDecisionResult {
    txHash: string;
    blockNumber: number;
    decisionIndex: number;
}
export declare class WalletService {
    private readonly configService;
    private readonly logger;
    private wallet;
    private providers;
    private contracts;
    constructor(configService: ConfigService);
    private initializeWallet;
    private initializeProviders;
    private initializeContracts;
    private getAgentIdentityAddress;
    getAddress(): string;
    getBalance(chain: string): Promise<string>;
    sendTransaction(chain: string, to: string, value: string, data?: string): Promise<TransactionResponse>;
    signMessage(message: string): Promise<string>;
    signTypedData(domain: object, types: object, message: object): Promise<string>;
    getOnChainDecisionCount(chain: string): Promise<number>;
    recordDecisionOnChain(chain: string, params: RecordDecisionParams): Promise<RecordDecisionResult>;
    hashInputForChain(data: string): string;
    hashOutputForChain(outputJson: string): string;
}
