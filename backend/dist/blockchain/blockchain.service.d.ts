import { ConfigService } from '../config/config.service';
import { JsonRpcProvider } from 'ethers';
export declare class BlockchainService {
    private readonly configService;
    private readonly logger;
    private providers;
    constructor(configService: ConfigService);
    private initializeProviders;
    getProvider(chain: string): JsonRpcProvider;
    getBlockNumber(chain: string): Promise<number>;
    getGasPrice(chain: string): Promise<string>;
}
