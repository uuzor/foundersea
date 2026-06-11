import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { JsonRpcProvider, Contract, ethers, isAddress } from 'ethers';
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
    this.providers.set('mantle', new JsonRpcProvider(this.configService.mantleSepoliaRpc));
  }

  private initializeContracts(): void {
    const address = this.getAgentIdentityAddress('mantle');
    if (!isAddress(address)) {
      this.logger.warn(`Skipping AgentIdentity init: invalid mantle address (${address || 'empty'})`);
      return;
    }

    const provider = this.providers.get('mantle');
    if (provider) {
      const contract = new Contract(address, AgentIdentityABI, provider);
      this.contracts.set('agentIdentity_mantle', contract);
      this.logger.log(`AgentIdentity contract initialized on mantle: ${address}`);
    }
  }

  private getAgentIdentityAddress(chain: string): string {
    return chain === 'mantle' ? this.configService.agentIdentityMantle : '';
  }

  getProvider(chain: string): JsonRpcProvider {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Unsupported chain: ${chain}. Only mantle is enabled.`);
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
