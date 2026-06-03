import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ethers, Wallet, JsonRpcProvider, TransactionResponse } from 'ethers';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private wallet: Wallet | null = null  ;
  private providers: Map<string, JsonRpcProvider> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeWallet();
    this.initializeProviders();
  }

  private initializeWallet(): void {
    const privateKey = this.configService.aiAgentPrivateKey;
    if (privateKey) {
      this.wallet = new Wallet(privateKey);
      this.logger.log(`AI Agent wallet initialized: ${this.wallet.address}`);
    } else {
      this.logger.warn('AI Agent private key not configured - wallet operations disabled');
    }
  }

  private initializeProviders(): void {
    this.providers.set('robinhood', new JsonRpcProvider(this.configService.robinhoodChainRpc));
    this.providers.set('mantle', new JsonRpcProvider(this.configService.mantleSepoliaRpc));
    this.providers.set('base', new JsonRpcProvider(this.configService.baseSepoliaRpc));
  }

  getAddress(): string {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return this.wallet.address;
  }

  async getBalance(chain: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    const balance = await provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  async sendTransaction(
    chain: string,
    to: string,
    value: string,
    data?: string,
  ): Promise<TransactionResponse> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const signer = this.wallet.connect(provider);

    const tx = await signer.sendTransaction({
      to,
      value: ethers.parseEther(value),
      data: data || '0x',
    });

    this.logger.log(`Transaction sent on ${chain}: ${tx.hash}`);
    return tx;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return this.wallet.signMessage(message);
  }

  async signTypedData(domain: object, types: object, message: object): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    // Simplified - would need proper EIP-712 signing
    return this.wallet.signMessage(JSON.stringify(message));
  }
}