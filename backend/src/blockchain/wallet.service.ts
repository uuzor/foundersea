import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ethers, Wallet, JsonRpcProvider, TransactionResponse, Contract, Interface, isHexString } from 'ethers';
import { AgentIdentityABI, DecisionType } from './abi/AgentIdentity';

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

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private wallet: Wallet | null = null;
  private providers: Map<string, JsonRpcProvider> = new Map();
  private contracts: Map<string, Contract> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeWallet();
    this.initializeProviders();
    this.initializeContracts();
  }

  private initializeWallet(): void {
    const privateKey = this.configService.aiAgentPrivateKey;
    if (privateKey && privateKey !== '0x_your_private_key_here' && isHexString(privateKey, 32)) {
      this.wallet = new Wallet(privateKey);
      this.logger.log(`AI Agent wallet initialized: ${this.wallet.address}`);
    } else {
      this.logger.warn('AI Agent private key not configured or invalid - wallet operations disabled');
    }
  }

  private initializeProviders(): void {
    this.providers.set('mantle', new JsonRpcProvider(this.configService.mantleSepoliaRpc));
  }

  private initializeContracts(): void {
    // Initialize AgentIdentity contract references per chain if wallet present
    const chains = ['mantle'];
    chains.forEach((chain) => {
      const address = this.getAgentIdentityAddress(chain);
      if (address) {
        const provider = this.providers.get(chain);
        if (provider) {
          // Keep contract instance for ethers usage as fallback
          const signer = this.wallet ? this.wallet.connect(provider) : provider;
          const contract = new Contract(address, AgentIdentityABI as any, signer as any);
          this.contracts.set(`agentIdentity_${chain}`, contract);
          this.logger.log(`AgentIdentity contract initialized on ${chain}: ${address}`);
        }
      }
    });
  }

  private getAgentIdentityAddress(chain: string): string {
    return chain === 'mantle' ? this.configService.agentIdentityMantle : '';
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
    return this.wallet.signMessage(JSON.stringify(message));
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
   * Record a decision on-chain via the AgentIdentity contract
   * This is the primary method for committing AI decisions to the blockchain
   */
  async recordDecisionOnChain(
    chain: string,
    params: RecordDecisionParams,
  ): Promise<RecordDecisionResult> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const contract = this.contracts.get(`agentIdentity_${chain}`);
    if (!contract) {
      throw new Error(`AgentIdentity not configured on ${chain}`);
    }

    // Get current decision count before the new decision
    const decisionCountBefore = await contract.totalDecisions();

    this.logger.log(
      `Recording decision on ${chain}: type=${params.decisionType}, subject=${params.subjectId}, confidence=${params.confidence}`
    );

    try {
      // Call recordDecision on the AgentIdentity contract
      const tx = await (contract as Contract).recordDecision(
        params.decisionType,
        params.subjectId,
        params.inputHash,
        params.outputHash,
        params.confidence,
        params.reasoningIpfsHash,
      );

      const receipt = await tx.wait();
      const blockNumber = receipt.blockNumber;
      const txHash = receipt.hash;

      // The decision index is the count before (since new decisions are appended at the end)
      const decisionIndex = Number(decisionCountBefore);

      this.logger.log(
        `Decision recorded on ${chain}: tx=${txHash}, block=${blockNumber}, index=${decisionIndex}`
      );

      return {
        txHash,
        blockNumber,
        decisionIndex,
      };
    } catch (error) {
      this.logger.error(`Failed to record decision on ${chain}: ${error}`);
      throw error;
    }
  }

  /**
   * Hash input data for on-chain recording
   * Uses keccak256 matching the AgentIdentity contract
   */
  hashInputForChain(data: string): string {
    // Convert string to bytes32 using keccak256
    const encoded = ethers.keccak256(ethers.toUtf8Bytes(data));
    return encoded;
  }

  /**
   * Hash output data for on-chain recording
   */
  hashOutputForChain(outputJson: string): string {
    const encoded = ethers.keccak256(ethers.toUtf8Bytes(outputJson));
    return encoded;
  }
}
