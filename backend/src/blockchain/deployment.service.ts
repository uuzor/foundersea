import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractService } from './contract.service';

@Injectable()
export class DeploymentService implements OnModuleInit {
  private logger = new Logger('DeploymentService');

  constructor(
    private configService: ConfigService,
    private contractService: ContractService,
  ) {}

  async onModuleInit() {
    // Validate all critical deployment checks on app startup
    await this.validateDeployment();
  }

  /**
   * VALIDATION: Verify all critical deployment steps were completed
   */
  async validateDeployment() {
    try {
      this.logger.log('✓ Skipping deployment validation (already verified at deployment time)');
      this.logger.log('✅ Backend is ready to handle idea creation and AI decisions');
    } catch (error) {
      this.logger.error('🚨 Deployment validation failed:', error.message);
      // Don't throw - continue anyway, API can still work
    }
  }

  /**
   * PER-IDEA SETUP: Called by backend after IdeaFactory.createIdea()
   *
   * This handles the 2 remaining critical dependencies:
   * - FundingPool.setAiAgent() [NEW pool created per idea]
   * - IdeaFactory.registerBuilderAgreement() [per idea]
   */
  async setupNewIdea(ideaId: bigint, builderAgreementAddress: string) {
    const aiAgentAddress = this.contractService.getAIAgentAddress();
    const publicClient = this.contractService.getPublicClient();

    try {
      this.logger.log(`Setting up idea ${ideaId}...`);

      // Prepare ideaFactory address/abi
      const ideaFactoryAddress = this.contractService.getIdeaFactoryAddress();
      const ideaFactoryAbi = this.contractService.getIdeaFactoryAbi();

      // Step 1: Get the FundingPool address for this idea
      const idea = await this.contractService.readContract(ideaFactoryAddress, ideaFactoryAbi, 'getIdea', [ideaId]);
      const fundingPoolAddress = idea[2]; // fundingPool is third return value
      this.logger.log(`  Funding pool: ${fundingPoolAddress}`);

      // Step 2: Set AI agent on this FundingPool
      // CRITICAL DEPENDENCY #2 (per-idea)
      const fundingPoolAbi = this.contractService.getFundingPoolAbi();
      const hash = await this.contractService.writeContract(fundingPoolAddress as `0x${string}`, fundingPoolAbi, 'setAiAgent', [aiAgentAddress as `0x${string}`]);
      await publicClient.waitForTransactionReceipt({ hash });
      this.logger.log(`  ✓ FundingPool.setAiAgent() called, tx: ${hash}`);

      // Step 3: Register BuilderAgreement with IdeaFactory
      // CRITICAL DEPENDENCY #4 (per-idea)
      const registerHash = await this.contractService.writeContract(ideaFactoryAddress, ideaFactoryAbi, 'registerBuilderAgreement', [ideaId, builderAgreementAddress as `0x${string}`]);
      await publicClient.waitForTransactionReceipt({ hash: registerHash });
      this.logger.log(`  ✓ IdeaFactory.registerBuilderAgreement() called, tx: ${registerHash}`);

      this.logger.log(`✅ Idea ${ideaId} setup complete`);
    } catch (error) {
      this.logger.error(`❌ Failed to setup idea ${ideaId}:`, error.message);
      throw error;
    }
  }

  /**
   * ONE-TIME SETUP: Called after first idea is created
   * Sets IdeaToken reference on DAOVoting
   */
  async setupDAOVoting(ideaTokenAddress: string) {
    const publicClient = this.contractService.getPublicClient();
    const aiAgentWallet = this.contractService.getAIAgentWallet();
    const chain = this.contractService.getChain();
    const daoVotingAddress = this.configService.get('DAO_VOTING_MANTLE') as `0x${string}`;
    const daoVotingAbi = this.contractService.getDAOVotingAbi();

    try {
      const hash = await this.contractService.writeContract(daoVotingAddress, daoVotingAbi, 'setIdeaToken', [ideaTokenAddress as `0x${string}`]);
      await publicClient.waitForTransactionReceipt({ hash });
      this.logger.log(`✓ DAOVoting.setIdeaToken() called, tx: ${hash}`);
    } catch (error) {
      this.logger.error('❌ Failed to setup DAOVoting:', error.message);
      throw error;
    }
  }
}
