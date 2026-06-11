import { Injectable, Logger } from '@nestjs/common';
import { ContractService } from '../blockchain/contract.service';
import { DeploymentService } from '../blockchain/deployment.service';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { keccak256, toHex } from 'viem';
import axios from 'axios';

@Injectable()
export class IdeaService {
  private logger = new Logger('IdeaService');
  private pinataApiKey: string;
  private pinataApiSecret: string;

  constructor(
    private contractService: ContractService,
    private deploymentService: DeploymentService,
  ) {
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataApiSecret = process.env.PINATA_API_SECRET || '';
  }

  /**
   * Create a new idea on-chain
   */
  async createIdea(dto: CreateIdeaDto) {
    const factory = this.contractService.getIdeaFactory();
    const publicClient = this.contractService.getPublicClient();
    const aiAgentWallet = this.contractService.getAIAgentWallet();
    const chain = this.contractService.getChain();

    try {
      this.logger.log(`Creating idea: ${dto.title}`);

      const metadata = {
        title: dto.title,
        description: dto.description,
        image: dto.image || '',
        category: dto.category || 'general',
        creator: dto.creator,
      };

      const metadataIpfsHash = await this.uploadToPinata(metadata);
      this.logger.log(`  Metadata uploaded to Pinata: ${metadataIpfsHash}`);

      // Use generic writeContract wrapper to avoid viem contract typing issues
      const ideaFactoryAddress = this.contractService.getIdeaFactoryAddress();
      const ideaFactoryAbi = this.contractService.getIdeaFactoryAbi();

      const hash = await this.contractService.writeContract(
        ideaFactoryAddress,
        ideaFactoryAbi,
        'createIdea',
        [
          {
            metadataIpfsHash: metadataIpfsHash,
            targetRaise: BigInt((dto as any).targetRaise || 0),
            softCap: BigInt((dto as any).softCap || 0),
            hardCap: BigInt((dto as any).hardCap || 0),
            fundingDeadline: BigInt((dto as any).fundingDeadline || 0),
            competitionPrizeBps: 1000,
            builderAllocBps: 3000,
            gateType: 0,
            gateParams: '0x',
          },
        ],
      );

      this.logger.log(`  Transaction sent: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      this.logger.log(`  Transaction confirmed: ${receipt.blockNumber}`);

      // Parse logs using publicClient's decoding or fallback to scanning logs for known topics
      let ideaCreatedEvent: any = null;
      try {
        // viem's public client can decode logs given the ABI; try to decode
        const logs = receipt.logs || [];
        for (const log of logs) {
          try {
            const parsed = this.contractService.getPublicClient().decodeEventLog({ abi: ideaFactoryAbi as any, data: log.data, topics: log.topics });
            if (parsed && parsed.name === 'IdeaCreated') {
              ideaCreatedEvent = { args: parsed.args };
              break;
            }
          } catch {
            // ignore decode errors per-log
          }
        }
      } catch {
        ideaCreatedEvent = null;
      }

      if (!ideaCreatedEvent) {
        throw new Error('IdeaCreated event not found in transaction receipt');
      }

      const ideaId = ideaCreatedEvent.args.ideaId;
      const fundingPoolAddress = ideaCreatedEvent.args.fundingPool;
      const ideaTokenAddress = ideaCreatedEvent.args.ideaToken;

      this.logger.log(`✓ Idea created: ideaId=${ideaId}`);
      this.logger.log(`  fundingPool: ${fundingPoolAddress}`);
      this.logger.log(`  ideaToken: ${ideaTokenAddress}`);

      return {
        ideaId,
        fundingPoolAddress,
        ideaTokenAddress,
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      this.logger.error('❌ Failed to create idea:', error.message);
      throw error;
    }
  }

  /**
   * Approve an idea as AI agent
   */
  async approveIdea(ideaId: bigint, score: number, reasonHash: string) {
    const factory = this.contractService.getIdeaFactory();
    const publicClient = this.contractService.getPublicClient();
    const aiAgentWallet = this.contractService.getAIAgentWallet();
    const chain = this.contractService.getChain();

    try {
      this.logger.log(`Approving idea ${ideaId} with score ${score}`);

      const ideaFactoryAddress = this.contractService.getIdeaFactoryAddress();
      const ideaFactoryAbi = this.contractService.getIdeaFactoryAbi();
      const hash = await this.contractService.writeContract(ideaFactoryAddress, ideaFactoryAbi, 'aiApproveIdea', [ideaId, BigInt(score), reasonHash]);

      this.logger.log(`  Transaction sent: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      this.logger.log(`✓ Idea approved: tx=${hash}`);

      return { ideaId, score, transactionHash: hash };
    } catch (error: any) {
      this.logger.error(`❌ Failed to approve idea ${ideaId}:`, error.message);
      throw error;
    }
  }

  /**
   * Setup a new idea after creation
   */
  async setupNewIdea(ideaId: bigint, builderAgreementAddress: string) {
    try {
      this.logger.log(`Setting up idea ${ideaId}...`);
      await this.deploymentService.setupNewIdea(ideaId, builderAgreementAddress);
      this.logger.log(`✓ Idea ${ideaId} setup complete`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to setup idea ${ideaId}:`, error.message);
      throw error;
    }
  }

  /**
   * One-time setup of DAOVoting with first idea's token
   */
  async setupDAOVotingOnce(ideaTokenAddress: string) {
    try {
      this.logger.log(`Setting up DAOVoting with idea token: ${ideaTokenAddress}`);
      await this.deploymentService.setupDAOVoting(ideaTokenAddress);
      this.logger.log(`✓ DAOVoting setup complete`);
    } catch (error: any) {
      this.logger.error('❌ Failed to setup DAOVoting:', error.message);
      throw error;
    }
  }

  /**
   * Get idea details by ID
   */
  async getIdea(ideaId: bigint) {
    try {
      const ideaFactoryAddress = this.contractService.getIdeaFactoryAddress();
      const ideaFactoryAbi = this.contractService.getIdeaFactoryAbi();

      // Ensure ABI is an array
      const abi = Array.isArray(ideaFactoryAbi) ? ideaFactoryAbi : JSON.parse(ideaFactoryAbi);

      const idea = await this.contractService.readContract(ideaFactoryAddress, abi, 'getIdea', [ideaId]);

      return {
        ideaId,
        creator: idea[0],
        ideaToken: idea[1],
        fundingPool: idea[2],
        fundingGate: idea[3],
        status: idea[4],
        aiScore: idea[5],
        approvalReasonHash: idea[6],
      };
    } catch (error: any) {
      this.logger.error(`Failed to get idea ${ideaId}:`, error.message);
      throw error;
    }
  }

  /**
   * List all ideas
   */
  async listIdeas(limit: number = 10) {
    try {
      const ideaFactoryAddress = this.contractService.getIdeaFactoryAddress();
      const ideaFactoryAbi = this.contractService.getIdeaFactoryAbi();

      // Ensure ABI is an array
      const abi = Array.isArray(ideaFactoryAbi) ? ideaFactoryAbi : JSON.parse(ideaFactoryAbi);

      const nextIdeaId = await this.contractService.readContract(ideaFactoryAddress, abi, 'nextIdeaId', []);

      const ideas: any[] = [];
      const totalIdeas = Number(nextIdeaId);
      const start = Math.max(0, totalIdeas - limit);

      for (let i = start; i < totalIdeas; i++) {
        const idea = await this.getIdea(BigInt(i));
        ideas.push(idea as any);
      }

      return ideas;
    } catch (error: any) {
      this.logger.error('Failed to list ideas:', error.message);
      throw error;
    }
  }

  /**
   * Create a BuilderAgreement for an idea
   */
  async createBuilderAgreement(ideaId: bigint, builders: string[], ipfsHash: string) {
    try {
      const builderAgreementAddress = this.contractService.getBuilderAgreement().address;
      const builderAgreementAbi = this.contractService.getBuilderAgreement().abi;
      const publicClient = this.contractService.getPublicClient();

      this.logger.log(`Creating BuilderAgreement for idea ${ideaId}`);

      const hash = await this.contractService.writeContract(
        builderAgreementAddress,
        builderAgreementAbi,
        'createAgreement',
        [ideaId, builders as unknown as `0x${string}`[], ipfsHash as `0x${string}`],
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      this.logger.log(`✓ BuilderAgreement created: tx=${hash}`);

      return {
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create BuilderAgreement for idea ${ideaId}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload metadata to Pinata
   */
  private async uploadToPinata(metadata: any): Promise<string> {
    try {
      if (!this.pinataApiKey || !this.pinataApiSecret) {
        this.logger.warn('Pinata credentials not configured, using keccak256 fallback');
        return keccak256(toHex(JSON.stringify(metadata)));
      }

      const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
      const response = await axios.post(url, metadata, {
        headers: {
          pinata_api_key: this.pinataApiKey,
          pinata_secret_api_key: this.pinataApiSecret,
          'Content-Type': 'application/json',
        },
      });

      return response.data.IpfsHash;
    } catch (error: any) {
      this.logger.warn('Failed to upload to Pinata, using keccak256 fallback:', error.message);
      const hash = keccak256(toHex(JSON.stringify(metadata)));
      return hash;
    }
  }
}
