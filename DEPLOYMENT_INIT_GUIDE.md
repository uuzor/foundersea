/**
 * DEPLOYMENT & INITIALIZATION GUIDE
 * ========================================
 * 
 * This document describes the complete deployment flow and per-idea initialization
 * required to avoid breaking the demo.
 */

// ========================================
// STEP 1: DEPLOY ALL CONTRACTS (Foundry)
// ========================================

// Run this command:
// forge script script/DeployComplete.s.sol:DeployComplete \
//   --rpc-url mantleSepolia \
//   --broadcast \
//   --verify

// This will:
// 1. Deploy all 7 core contracts
// 2. Call CRITICAL initializations:
//    ✓ AgentIdentity.mintAgent()
//    ✓ AgentIdentity.setAiAgent()
//    ✓ IdeaFactory.setAiAgent()
//    ✓ DAOVoting.setAiAgent()
//    ✓ IdeaFactory.setFactories()
// 
// Output: Addresses to copy into .env.local

// ========================================
// STEP 2: BACKEND INITIALIZATION (NestJS)
// ========================================

// File: backend/src/blockchain/deployment.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getContract, publicClient } from 'viem';
import { fundingPoolAbi } from '../abis/FundingPool';

@Injectable()
export class DeploymentService implements OnModuleInit {
  private logger = new Logger('DeploymentService');

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Called on app startup
    // This validates that all critical init calls were made at deployment time
    await this.validateDeployment();
  }

  /**
   * VALIDATION: Verify all critical deployment steps were completed
   */
  async validateDeployment() {
    const ideaFactory = this.getIdeaFactory();
    const agentIdentity = this.getAgentIdentity();
    const daoVoting = this.getDAOVoting();

    try {
      // Check 1: AgentIdentity has AI agent set
      const agentId = await agentIdentity.read.agentId();
      const aiAgent = await agentIdentity.read.aiAgent();
      if (aiAgent === '0x0000000000000000000000000000000000000000') {
        throw new Error('❌ AgentIdentity.aiAgent not set. Run: agentIdentity.setAiAgent(aiAgentAddr)');
      }
      this.logger.log('✓ AgentIdentity.aiAgent is set:', aiAgent);

      // Check 2: IdeaFactory has AI agent set
      const factoryAiAgent = await ideaFactory.read.aiAgent();
      if (factoryAiAgent === '0x0000000000000000000000000000000000000000') {
        throw new Error('❌ IdeaFactory.aiAgent not set. Run: ideaFactory.setAiAgent(aiAgentAddr)');
      }
      this.logger.log('✓ IdeaFactory.aiAgent is set:', factoryAiAgent);

      // Check 3: DAOVoting has AI agent set
      const daoAiAgent = await daoVoting.read.aiAgent();
      if (daoAiAgent === '0x0000000000000000000000000000000000000000') {
        throw new Error('❌ DAOVoting.aiAgent not set. Run: daoVoting.setAiAgent(aiAgentAddr)');
      }
      this.logger.log('✓ DAOVoting.aiAgent is set:', daoAiAgent);

      this.logger.log('✅ All critical deployment checks passed');
    } catch (error) {
      this.logger.error('🚨 Deployment validation failed:', error.message);
      throw error;
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
    const ideaFactory = this.getIdeaFactory();
    const aiAgentAddress = this.configService.get('AI_AGENT_ADDRESS');

    try {
      this.logger.log(`Setting up idea ${ideaId}...`);

      // Step 1: Get the FundingPool address for this idea
      const idea = await ideaFactory.read.getIdea([ideaId]);
      const fundingPoolAddress = idea[2]; // fundingPool is third return value
      this.logger.log(`  Funding pool: ${fundingPoolAddress}`);

      // Step 2: Set AI agent on this FundingPool
      // CRITICAL DEPENDENCY #2 (per-idea)
      const fundingPool = getContract({
        address: fundingPoolAddress,
        abi: fundingPoolAbi,
        client: publicClient,
      });

      const hash = await fundingPool.write.setAiAgent([aiAgentAddress], {
        account: this.getAiAgentWallet(),
        chain: this.getChain(),
      });

      await publicClient.waitForTransactionReceipt({ hash });
      this.logger.log(`  ✓ FundingPool.setAiAgent() called, tx: ${hash}`);

      // Step 3: Register BuilderAgreement with IdeaFactory
      // CRITICAL DEPENDENCY #4 (per-idea)
      const registerHash = await ideaFactory.write.registerBuilderAgreement(
        [ideaId, builderAgreementAddress as `0x${string}`],
        {
          account: this.getCreatorWallet(), // Creator must call this
          chain: this.getChain(),
        }
      );

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
    const daoVoting = this.getDAOVoting();

    try {
      const hash = await daoVoting.write.setIdeaToken([ideaTokenAddress as `0x${string}`], {
        account: this.getOwnerWallet(),
        chain: this.getChain(),
      });

      await publicClient.waitForTransactionReceipt({ hash });
      this.logger.log(`✓ DAOVoting.setIdeaToken() called, tx: ${hash}`);
    } catch (error) {
      this.logger.error('❌ Failed to setup DAOVoting:', error.message);
      throw error;
    }
  }

  private getIdeaFactory() {
    // Return viem contract instance for IdeaFactory
  }

  private getAgentIdentity() {
    // Return viem contract instance for AgentIdentity
  }

  private getDAOVoting() {
    // Return viem contract instance for DAOVoting
  }

  private getAiAgentWallet() {
    // Return signer for AI agent wallet
  }

  private getCreatorWallet() {
    // Return signer for creator
  }

  private getOwnerWallet() {
    // Return signer for contract owner
  }

  private getChain() {
    // Return chain configuration (Mantle Sepolia, etc.)
  }
}

// ========================================
// STEP 3: BACKEND API CHANGES
// ========================================

// File: backend/src/ideas/ideas.controller.ts

import { Post, Body } from '@nestjs/common';
import { IdeasService } from './ideas.service';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { DeploymentService } from '../blockchain/deployment.service';

@Controller('ideas')
export class IdeasController {
  constructor(
    private ideasService: IdeasService,
    private deploymentService: DeploymentService,
  ) {}

  @Post()
  async createIdea(@Body() dto: CreateIdeaDto) {
    try {
      // 1. Call IdeaFactory.createIdea()
      const result = await this.ideasService.createIdea(dto);
      const { ideaId } = result;

      // 2. CRITICAL: Call per-idea setup
      // This sets FundingPool.setAiAgent() and registers BuilderAgreement
      const builderAgreementAddress = await this.ideasService.createBuilderAgreement(ideaId);
      await this.deploymentService.setupNewIdea(ideaId, builderAgreementAddress);

      // 3. ONE-TIME: Set IdeaToken on DAOVoting (if first idea)
      if (ideaId === 1n) {
        const ideaTokenAddress = result.ideaTokenAddress;
        await this.deploymentService.setupDAOVoting(ideaTokenAddress);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }
}

// ========================================
// DEPLOYMENT CHECKLIST
// ========================================

// [ ] 1. Deploy contracts via forge
//       forge script script/DeployComplete.s.sol:DeployComplete \
//         --rpc-url mantleSepolia \
//         --broadcast
//
// [ ] 2. Copy addresses from deployment output to .env.local
//
// [ ] 3. Verify all CRITICAL checks pass:
//       ✓ AgentIdentity.aiAgent is set
//       ✓ IdeaFactory.aiAgent is set
//       ✓ DAOVoting.aiAgent is set
//
// [ ] 4. Test flow:
//       - Create an idea via API POST /ideas
//       - Verify setupNewIdea() succeeds (FundingPool.setAiAgent + registerBuilderAgreement)
//       - Call IdeaFactory.aiApproveIdea() as AI agent
//       - Verify AgentIdentity.recordDecision() logged
//
// [ ] 5. Test milestone validation:
//       - Call FundingPool.assignBuilder()
//       - Builder calls submitMilestone()
//       - AI calls FundingPool.setMilestoneValidated()
//       - Verify status changes to VALIDATED
//       - AI calls releaseMilestone() to auto-release funds

// ========================================
// CRITICAL DEPENDENCIES SUMMARY
// ========================================

// At Deployment Time (DeployComplete.s.sol):
// ✓ 1. AgentIdentity.mintAgent()
// ✓ 2. AgentIdentity.setAiAgent()
// ✓ 3. IdeaFactory.setAiAgent()
// ✓ 4. DAOVoting.setAiAgent()
// ✓ 5. IdeaFactory.setFactories()

// Per-Idea Time (Backend setupNewIdea):
// ✓ 6. FundingPool.setAiAgent() [NEW pool per idea]
// ✓ 7. IdeaFactory.registerBuilderAgreement()

// One-Time After First Idea:
// ✓ 8. DAOVoting.setIdeaToken()

// ========================================
