import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ethers, JsonRpcProvider, Contract } from 'ethers';

export interface ContractReadResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface FundingPoolState {
  raisedAmount: string;
  softCap: string;
  hardCap: string;
  fundingClosed: boolean;
  builderAssigned: boolean;
  competitorsSet: boolean;
  milestones: Array<{
    amount: string;
    released: boolean;
    aiValidated: boolean;
    aiConfidence: string;
  }>;
  competitorPayouts: Array<{
    builder: string;
    amount: string;
    released: boolean;
    aiConfidence: string;
  }>;
}

@Injectable()
export class BlockchainTools {
  private readonly logger = new Logger(BlockchainTools.name);
  private providers: Map<string, JsonRpcProvider> = new Map();

  constructor(private readonly configService: ConfigService) {
    // Initialize providers
    this.providers.set('mantle', new JsonRpcProvider(this.configService.mantleSepoliaRpc));
  }

  /**
   * Get provider for a chain
   */
  private getProvider(chain: string): JsonRpcProvider {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Unknown chain: ${chain}. Supported: mantle`);
    }
    return provider;
  }

  /**
   * Read from a contract
   */
  async readContract(
    chain: string,
    contractAddress: string,
    method: string,
    args: string[] = [],
  ): Promise<ContractReadResult> {
    try {
      const provider = this.getProvider(chain);
      const code = await provider.getCode(contractAddress);

      if (code === '0x') {
        return {
          success: false,
          error: `No contract at address: ${contractAddress}`,
        };
      }

      // Create a minimal ABI for the method
      const iface = new ethers.Interface([`function ${method}(${args.map(() => 'uint256').join(',')}) view returns (uint256)`]);

      const data = iface.encodeFunctionData(method, args);
      const result = await provider.call({ to: contractAddress, data });

      // Decode result (assuming uint256 return)
      const decoded = iface.decodeFunctionResult(method, result);

      return {
        success: true,
        result: decoded[0].toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to read contract: ${contractAddress}.${method}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get funding pool state for an idea
   */
  async getFundingPoolState(chain: string, ideaId: string): Promise<FundingPoolState> {
    // Get the appropriate factory address based on chain
    let factoryAddress: string;
      if (chain !== 'mantle') {
        throw new Error(`Unsupported chain: ${chain}. Only mantle is enabled.`);
      }

      factoryAddress = this.configService.ideaFactoryMantle;

    if (!factoryAddress) {
      throw new Error(`Factory not configured for chain: ${chain}`);
    }

    try {
      const provider = this.getProvider(chain);

      // ABI for FundingPool and IdeaFactory
      const factoryAbi = [
        'function fundingPools(uint256) view returns (address)',
      ];

      const factory = new Contract(factoryAddress, factoryAbi, provider);
      const fundingPoolAddress = await factory.fundingPools(parseInt(ideaId, 10));

      if (fundingPoolAddress === ethers.ZeroAddress) {
        throw new Error(`Funding pool not found for idea: ${ideaId}`);
      }

      // Get funding pool data
      const poolAbi = [
        'function raisedAmount() view returns (uint256)',
        'function softCap() view returns (uint256)',
        'function hardCap() view returns (uint256)',
        'function fundingClosed() view returns (bool)',
        'function builderAssigned() view returns (bool)',
        'function competitorsSet() view returns (bool)',
        'function getMilestoneCount() view returns (uint256)',
        'function competitorPayouts(uint256) view returns (address builder, uint256 amount, bool released, uint256 aiConfidence, string validationIpfsHash)',
      ];

      const pool = new Contract(fundingPoolAddress, poolAbi, provider);

      const [raisedAmount, softCap, hardCap, fundingClosed, builderAssigned, competitorsSet] =
        await Promise.all([
          pool.raisedAmount(),
          pool.softCap(),
          pool.hardCap(),
          pool.fundingClosed(),
          pool.builderAssigned(),
          pool.competitorsSet(),
        ]);

      // Get milestones
      const milestoneCount = await pool.getMilestoneCount();
       const milestones: any[] = [];
      for (let i = 0; i < Math.min(Number(milestoneCount), 10); i++) {
        // Simplified - would need full milestone struct
        milestones.push({
          amount: '0',
          released: false,
          aiValidated: false,
          aiConfidence: '0',
        });
      }

      // Get competitor payouts
       const competitorPayouts: any[] = [];
       for (let i = 0; i < 3; i++) {
        try {
          const payout = await pool.competitorPayouts(i);
           competitorPayouts.push({
            builder: payout[0],
            amount: payout[1].toString(),
            released: payout[2],
            aiConfidence: payout[3].toString(),
          });
        } catch {
          competitorPayouts.push({
            builder: ethers.ZeroAddress,
            amount: '0',
            released: false,
            aiConfidence: '0',
          });
        }
      }

      return {
        raisedAmount: raisedAmount.toString(),
        softCap: softCap.toString(),
        hardCap: hardCap.toString(),
        fundingClosed,
        builderAssigned,
        competitorsSet,
        milestones,
        competitorPayouts,
      };
    } catch (error) {
      this.logger.error(`Failed to get funding pool state for idea: ${ideaId}`, error);
      throw error;
    }
  }
}
