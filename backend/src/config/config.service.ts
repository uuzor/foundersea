import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  // AI Configuration
  get tokenRouterApiKey(): string {
    return this.configService.get<string>('TOKENROUTER_API_KEY', '');
  }

  get tokenRouterBaseUrl(): string {
    return this.configService.get<string>('TOKENROUTER_BASE_URL', 'https://api.tokenrouter.io/v1');
  }

  // GitHub Configuration
  get githubToken(): string {
    return this.configService.get<string>('GITHUB_TOKEN', '');
  }

  // Serper (Web Search) Configuration
  get serperApiKey(): string {
    return this.configService.get<string>('SERPER_API_KEY', '');
  }

  // Pinata (IPFS) Configuration
  get pinataApiKey(): string {
    return this.configService.get<string>('PINATA_API_KEY', '');
  }

  get pinataSecret(): string {
    return this.configService.get<string>('PINATA_SECRET', '');
  }

  // Blockchain RPCs
  get robinhoodChainRpc(): string {
    return this.configService.get<string>('ROBINHOOD_CHAIN_RPC', 'https://testnet.rpc.robinhood.com');
  }

  get mantleSepoliaRpc(): string {
    return this.configService.get<string>('MANTLE_SEPOLIA_RPC', 'https://rpc.sepolia.mantle.xyz');
  }

  get baseSepoliaRpc(): string {
    return this.configService.get<string>('BASE_SEPOLIA_RPC', 'https://sepolia.base.org');
  }

  // AI Agent Wallet
  get aiAgentPrivateKey(): string {
    return this.configService.get<string>('AI_AGENT_PRIVATE_KEY', '');
  }

  // Deployed Contract Addresses
  get ideaFactoryMantle(): string {
    return this.configService.get<string>('IDEA_FACTORY_MANTLE', '');
  }

  get agentIdentityMantle(): string {
    return this.configService.get<string>('AGENT_IDENTITY_MANTLE', '');
  }

  get daoVotingMantle(): string {
    return this.configService.get<string>('DAO_VOTING_MANTLE', '');
  }

  get ideaMarketplaceMantle(): string {
    return this.configService.get<string>('IDEA_MARKETPLACE_MANTLE', '');
  }

  get ideaFactoryBase(): string {
    return this.configService.get<string>('IDEA_FACTORY_BASE', '');
  }

  get agentIdentityBase(): string {
    return this.configService.get<string>('AGENT_IDENTITY_BASE', '');
  }

  get daoVotingBase(): string {
    return this.configService.get<string>('DAO_VOTING_BASE', '');
  }

  get ideaMarketplaceBase(): string {
    return this.configService.get<string>('IDEA_MARKETPLACE_BASE', '');
  }

  get ideaFactoryRHC(): string {
    return this.configService.get<string>('IDEA_FACTORY_RHC', '');
  }

  get agentIdentityRHC(): string {
    return this.configService.get<string>('AGENT_IDENTITY_RHC', '');
  }

  get daoVotingRHC(): string {
    return this.configService.get<string>('DAO_VOTING_RHC', '');
  }

  get ideaMarketplaceRHC(): string {
    return this.configService.get<string>('IDEA_MARKETPLACE_RHC', '');
  }

  // USDY Addresses
  get usdyMantle(): string {
    return this.configService.get<string>('USDY_MANTLE', '');
  }

  get usdyBase(): string {
    return this.configService.get<string>('USDY_BASE', '');
  }

  // Webhook Configuration
  get webhookBaseUrl(): string {
    return this.configService.get<string>('WEBHOOK_BASE_URL', '');
  }

  // Server Configuration
  get port(): number {
    return parseInt(this.configService.get<string>('PORT', '3000'), 10);
  }
}