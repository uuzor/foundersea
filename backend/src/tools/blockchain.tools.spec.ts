import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainTools } from './blockchain.tools';
import { ConfigService } from '../config/config.service';

// Mock ethers
jest.mock('ethers', () => ({
  JsonRpcProvider: jest.fn().mockImplementation(() => ({
    getCode: jest.fn().mockResolvedValue('0x123456'),
  })),
  Contract: jest.fn().mockImplementation(() => ({
    fundingPools: jest.fn(),
    raisedAmount: jest.fn(),
    softCap: jest.fn(),
    hardCap: jest.fn(),
    fundingClosed: jest.fn(),
    builderAssigned: jest.fn(),
    competitorsSet: jest.fn(),
    getMilestoneCount: jest.fn(),
    competitorPayouts: jest.fn(),
  })),
  ZeroAddress: '0x0000000000000000000000000000000000000000',
}));

describe('BlockchainTools', () => {
  let tools: BlockchainTools;

  const createMockConfigService = (): ConfigService => ({
    robinhoodChainRpc: 'https://testnet.rpc.robinhood.com',
    mantleSepoliaRpc: 'https://rpc.sepolia.mantle.xyz',
    baseSepoliaRpc: 'https://sepolia.base.org',
    ideaFactoryMantle: '0x1234567890123456789012345678901234567890',
    ideaFactoryBase: '0x1234567890123456789012345678901234567890',
    ideaFactoryRHC: '0x1234567890123456789012345678901234567890',
  } as unknown as ConfigService);

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProvider', () => {
    it('should return provider for valid chain', () => {
      const mockConfig = createMockConfigService();
      const tools = new BlockchainTools(mockConfig);
      const provider = (tools as any).getProvider('robinhood');
      expect(provider).toBeDefined();
    });

    it('should return provider for mantle chain', () => {
      const mockConfig = createMockConfigService();
      const tools = new BlockchainTools(mockConfig);
      const provider = (tools as any).getProvider('mantle');
      expect(provider).toBeDefined();
    });

    it('should return provider for base chain', () => {
      const mockConfig = createMockConfigService();
      const tools = new BlockchainTools(mockConfig);
      const provider = (tools as any).getProvider('base');
      expect(provider).toBeDefined();
    });

    it('should throw error for unsupported chain', () => {
      const mockConfig = createMockConfigService();
      const tools = new BlockchainTools(mockConfig);
      expect(() => (tools as any).getProvider('unsupported')).toThrow('Unknown chain: unsupported');
    });
  });

  describe('readContract', () => {
    it('should return error for unsupported chain', async () => {
      const mockConfig = createMockConfigService();
      const tools = new BlockchainTools(mockConfig);
      const result = await tools.readContract('unsupported', '0x123', 'method', []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown chain');
    });
  });

  describe('getFundingPoolState', () => {
    it('should throw error for unsupported chain', async () => {
      const mockConfig = createMockConfigService();
      const tools = new BlockchainTools(mockConfig);
      await expect(tools.getFundingPoolState('unsupported', '1')).rejects.toThrow('Unknown chain: unsupported');
    });

    it('should throw error when factory not configured for chain', async () => {
      const mockConfig = {
        robinhoodChainRpc: 'https://testnet.rpc.robinhood.com',
        mantleSepoliaRpc: 'https://rpc.sepolia.mantle.xyz',
        baseSepoliaRpc: 'https://sepolia.base.org',
        ideaFactoryMantle: '', // Empty factory
        ideaFactoryBase: '',
        ideaFactoryRHC: '',
      } as unknown as ConfigService;
      const tools = new BlockchainTools(mockConfig);
      await expect(tools.getFundingPoolState('mantle', '1')).rejects.toThrow('Factory not configured');
    });
  });
});