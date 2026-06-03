import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { JsonRpcProvider, Contract, ethers } from 'ethers';
import { AgentIdentityABI, DecisionType } from './abi/AgentIdentity';

export interface OnChainDecision {
  txHash: string;
  blockNumber: number;
  decisionIndex: number;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private providers: Map<string, JsonRpcProvider> = new Map();
  private contracts: Map<string, Contract> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeProviders();
    this.initializeContracts();
  }

  private initializeProviders(): void {
    this.providers.set('robinhood', new JsonRpcProvider(this.configService.robinhoodChainRpc));
    this.providers.set('mantle', new JsonRpcProvider(this.configService.mantleSepoliaRpc));
    this.providers.set('base', new JsonRpcProvider(this.configService.baseSepoliaRpc));
  }

  private initializeContracts(): void {
    // Initialize AgentIdentity contract on each chain
    const chains = ['mantle', 'base', 'robinhood'];
    chains.forEach((chain) => {
      const address = this.getAgentIdentityAddress(chain);
      if (address) {
        const provider = this.providers.get(chain);
        if (provider) {
          const contract = new Contract(address, AgentIdentityABI, provider);
          this.contracts.set(`agentIdentity_${chain}`, contract);
          this.logger.log(`AgentIdentity contract initialized on ${chain}: ${address}`);
        }
      }
    });
  }

  private getAgentIdentityAddress(chain: string): string {
    switch (chain) {
      case 'mantle':
        return this.configService.agentIdentityMantle;
      case 'base':
        return this.configService.agentIdentityBase;
      case 'robinhood':
        return this.configService.agentIdentityRHC;
      default:
        return '';
    }
  }

  getProvider(chain: string): JsonRpcProvider {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    return provider;
  }

  getContract(contractKey: string): Contract {
    const contract = this.contracts.get(contractKey);
    if (!contract) {
      throw new Error(`Contract not found: ${contractKey}`);
    }
    return contract;
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

  /**
   * Get the current on-chain decision count from AgentIdentity
   */
  async getOnChainDecisionCount(chain: string): Promise<number> {
    try {
      const contract = this.contracts.get(`agentIdentity_${chain}`);
      if (!contract) {
        throw new Error(`AgentIdentity not configured on ${chain}`);
      }
      return await contract.totalDecisions();
    } catch (error) {
      this.logger.error(`Failed to get decision count on ${chain}: ${error}`);
      return 0;
    }
  }

  /**
   * Get a decision by index from AgentIdentity
   */
  async getOnChainDecision(chain: string, index: number): Promise<any> {
    try {
      const contract = this.contracts.get(`agentIdentity_${chain}`);
      if (!contract) {
        throw new Error(`AgentIdentity not configured on ${chain}`);
      }
      return await contract.getDecision(index);
    } catch (error) {
      this.logger.error(`Failed to get decision ${index} on ${chain}: ${error}`);
      return null;
    }
  }
}