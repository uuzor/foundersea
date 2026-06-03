import { ConfigService } from '../config/config.service';
import { TransactionResponse } from 'ethers';
export declare class WalletService {
    private readonly configService;
    private readonly logger;
    private wallet;
    private providers;
    constructor(configService: ConfigService);
    private initializeWallet;
    private initializeProviders;
    getAddress(): string;
    getBalance(chain: string): Promise<string>;
    sendTransaction(chain: string, to: string, value: string, data?: string): Promise<TransactionResponse>;
    signMessage(message: string): Promise<string>;
    signTypedData(domain: object, types: object, message: object): Promise<string>;
}
