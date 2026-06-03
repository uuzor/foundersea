import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { JsonRpcProvider, Contract } from 'ethers';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private providers: Map<string, JsonRpcProvider> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set('robinhood', new JsonRpcProvider(this.configService.robinhoodChainRpc));
    this.providers.set('mantle', new JsonRpcProvider(this.configService.mantleSepoliaRpc));
    this.providers.set('base', new JsonRpcProvider(this.configService.baseSepoliaRpc));
  }

  getProvider(chain: string): JsonRpcProvider {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    return provider;
  }

  async getBlockNumber(chain: string): Promise<number> {
    const provider = this.getProvider(chain);
    return provider.getBlockNumber();
  }

  async getGasPrice(chain: string): Promise<string> {
    const provider = this.getProvider(chain);
    const feeData = await provider.getFeeData();
    return feeData.gasPrice?.toString() || '0';
  }
}