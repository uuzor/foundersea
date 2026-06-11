import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  Chain,
} from 'viem';
// Mantle Sepolia Testnet — chain ID 5003 (not in viem/chains, defined manually)
const mantleSepolia: Chain = {
  id: 5003,
  name: 'Mantle Sepolia',
  network: 'mantle-sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia.mantle.xyz'] },
    public:  { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantlescan', url: 'https://sepolia.mantlescan.xyz' },
  },
  testnet: true,
} as Chain;
import {
  ideaFactoryAbi,
  fundingPoolAbi,
  agentIdentityAbi,
  daoVotingAbi,
  ideaTokenFactoryAbi,
  fundingPoolFactoryAbi,
  builderAgreementAbi,
  ideaTokenAbi,
  ideaMarketplaceAbi,
} from './abi';

@Injectable()
export class ContractService implements OnModuleInit {
  private logger = new Logger('ContractService');
  private publicClient: any;
  private aiAgentWallet: any;
  private chain: Chain;

  constructor(private configService: ConfigService) {
    this.chain = mantleSepolia;
  }

  async onModuleInit() {
    this.initializeClients();
    this.logger.log('✅ Contract clients initialized');
  }

  private initializeClients() {
    const rpcUrl =
      this.configService.get('RPC_URL') ||
      this.configService.get('MANTLE_SEPOLIA_RPC') ||
      'https://rpc.sepolia.mantle.xyz';

    // Public client for read operations
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    });

    // Wallet client for AI agent write operations
    const aiAgentPrivateKey = this.configService.get('AI_AGENT_PRIVATE_KEY');
    if (!aiAgentPrivateKey || aiAgentPrivateKey === '0x_your_private_key_here') {
      this.logger.warn('AI_AGENT_PRIVATE_KEY not configured or invalid - write operations disabled');
      return;
    }

    this.aiAgentWallet = createWalletClient({
      chain: this.chain,
      transport: http(rpcUrl),
      account: aiAgentPrivateKey as `0x${string}`,
    });
  }

  getPublicClient() {
    return this.publicClient;
  }

  getAIAgentWallet() {
    return this.aiAgentWallet;
  }

  getChain() {
    return this.chain;
  }

  getIdeaFactory() {
    const address = this.getIdeaFactoryAddress();
    return this.getContractWrapper(address, ideaFactoryAbi as any);
  }

  // --- Helper accessors for addresses and ABIs (useful for read/write wrappers) ---
  getIdeaFactoryAddress(): `0x${string}` {
    return this.configService.get('IDEA_FACTORY_MANTLE') as `0x${string}`;
  }

  getIdeaFactoryAbi(): any {
    return ideaFactoryAbi as any;
  }

  getAgentIdentityAddress(): `0x${string}` {
    return this.configService.get('AGENT_IDENTITY_MANTLE') as `0x${string}`;
  }

  getAgentIdentityAbi(): any {
    return agentIdentityAbi as any;
  }

  getFundingPoolAbi(): any {
    return fundingPoolAbi as any;
  }

  /** Generic read wrapper using publicClient.readContract to avoid relying on contract.read typing */
  async readContract(address: `0x${string}`, abi: any, functionName: string, args: any[] = []) {
    return await this.publicClient.readContract({ address, abi, functionName, args });
  }

  /** Generic write wrapper using wallet client writeContract - with proper signing */
  async writeContract(address: `0x${string}`, abi: any, functionName: string, args: any[] = []) {
    if (!this.aiAgentWallet) {
      throw new Error('AI Agent wallet not initialized - write operations are disabled');
    }
    try {
      // writeContract with wallet client handles local signing and sends raw transaction
      return await this.aiAgentWallet.writeContract({
        address,
        abi,
        functionName,
        args,
        // Add gas estimation for safety
        gas: BigInt(3000000),
      });
    } catch (error: any) {
      this.logger.error(`Failed to write contract:`, error.message);
      throw error;
    }
  }

  getFundingPoolFactory() {
    const address = this.configService.get('FUNDING_POOL_FACTORY_MANTLE') as `0x${string}`;
    if (!address) throw new Error('FUNDING_POOL_FACTORY_MANTLE not configured');
    return this.getContractWrapper(address, fundingPoolFactoryAbi as any);
  }

  getIdeaTokenFactory() {
    const address = this.configService.get('IDEA_TOKEN_FACTORY_MANTLE') as `0x${string}`;
    if (!address) throw new Error('IDEA_TOKEN_FACTORY_MANTLE not configured');
    return this.getContractWrapper(address, ideaTokenFactoryAbi as any);
  }

  getFundingPool(fundingPoolAddress: string) {
    if (!fundingPoolAddress) throw new Error('FundingPool address required');
    return this.getContractWrapper(fundingPoolAddress as `0x${string}`, fundingPoolAbi as any);
  }

  getIdeaToken(ideaTokenAddress: string) {
    if (!ideaTokenAddress) throw new Error('IdeaToken address required');
    return this.getContractWrapper(ideaTokenAddress as `0x${string}`, ideaTokenAbi as any);
  }

  getAgentIdentity() {
    const address = this.getAgentIdentityAddress();
    return this.getContractWrapper(address, agentIdentityAbi as any);
  }

  getDAOVoting() {
    const address = this.configService.get('DAO_VOTING_MANTLE') as `0x${string}`;
    if (!address) throw new Error('DAO_VOTING_MANTLE not configured');
    return this.getContractWrapper(address, daoVotingAbi as any);
  }

  getDAOVotingAbi(): any {
    return daoVotingAbi as any;
  }

  getBuilderAgreement() {
    const address = this.configService.get('BUILDER_AGREEMENT_MANTLE') as `0x${string}`;
    if (!address) throw new Error('BUILDER_AGREEMENT_MANTLE not configured');
    return this.getContractWrapper(address, builderAgreementAbi as any);
  }

  getIdeaMarketplace() {
    const address = this.configService.get('IDEA_MARKETPLACE_MANTLE') as `0x${string}`;
    if (!address) throw new Error('IDEA_MARKETPLACE_MANTLE not configured');
    return this.getContractWrapper(address, ideaMarketplaceAbi as any);
  }

  /**
   * Return a lightweight wrapper that exposes .address, .abi and .read/.write proxies
   * so existing code that calls contract.read.foo([args]) or contract.write.bar([args]) still works.
   */
  private getContractWrapper(address: `0x${string}`, abi: any) {
    const self = this;
    const proxyRead = new Proxy({}, {
      get(_t, prop: string) {
        return async (args: any[] = []) => {
          // If caller passes single array (e.g., factory.read.getIdea([ideaId]))
          const finalArgs = Array.isArray(args[0]) && args.length === 1 ? args[0] : args;
          return await self.readContract(address, abi, prop, finalArgs);
        };
      }
    });

    const proxyWrite = new Proxy({}, {
      get(_t, prop: string) {
        return async (args: any[] = []) => {
          const finalArgs = Array.isArray(args[0]) && args.length === 1 ? args[0] : args;
          return await self.writeContract(address, abi, prop, finalArgs);
        };
      }
    });

    return {
      address,
      abi,
      read: proxyRead,
      write: proxyWrite,
    } as any;
  }

  getAIAgentAddress() {
    const address = this.configService.get('AI_AGENT_ADDRESS');
    if (!address) throw new Error('AI_AGENT_ADDRESS not configured');
    return address;
  }

  getUSDYAddress() {
    const address = this.configService.get('USDY_MANTLE');
    if (!address) throw new Error('USDY_MANTLE not configured');
    return address;
  }
}
