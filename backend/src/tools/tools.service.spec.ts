import { Test, TestingModule } from '@nestjs/testing';
import { ToolsService, ToolResult } from './tools.service';
import { GithubTools } from './github.tools';
import { WebTools } from './web.tools';
import { BlockchainTools } from './blockchain.tools';
import { IpfsTools } from './ipfs.tools';
import { ConfigService } from '../config/config.service';

describe('ToolsService', () => {
  let service: ToolsService;
  let mockGithubTools: Partial<GithubTools>;
  let mockWebTools: Partial<WebTools>;
  let mockBlockchainTools: Partial<BlockchainTools>;
  let mockIpfsTools: Partial<IpfsTools>;

  beforeEach(async () => {
    mockGithubTools = {
      getRepo: jest.fn(),
      getCommits: jest.fn(),
      getFile: jest.fn(),
      getTestResults: jest.fn(),
    };

    mockWebTools = {
      search: jest.fn(),
      fetchUrl: jest.fn(),
    };

    mockBlockchainTools = {
      readContract: jest.fn(),
      getFundingPoolState: jest.fn(),
    };

    mockIpfsTools = {
      pinReasoning: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolsService,
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: GithubTools,
          useValue: mockGithubTools,
        },
        {
          provide: WebTools,
          useValue: mockWebTools,
        },
        {
          provide: BlockchainTools,
          useValue: mockBlockchainTools,
        },
        {
          provide: IpfsTools,
          useValue: mockIpfsTools,
        },
      ],
    }).compile();

    service = module.get<ToolsService>(ToolsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeTool', () => {
    it('should execute github_get_repo tool', async () => {
      const repoData = { name: 'test-repo', stars: 100 };
      (mockGithubTools.getRepo as jest.Mock).mockResolvedValue(repoData);

      const result = await service.executeTool('github_get_repo', { repo_url: 'https://github.com/owner/repo' });

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('github_get_repo');
      expect(result.data).toEqual(repoData);
      expect(mockGithubTools.getRepo).toHaveBeenCalledWith('https://github.com/owner/repo');
    });

    it('should execute github_get_commits tool', async () => {
      const commitsData = [{ sha: 'abc123', message: 'test commit' }];
      (mockGithubTools.getCommits as jest.Mock).mockResolvedValue(commitsData);

      const result = await service.executeTool('github_get_commits', {
        repo_url: 'https://github.com/owner/repo',
        since_date: '2024-01-01',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(commitsData);
    });

    it('should execute github_get_file tool', async () => {
      const fileData = { path: 'README.md', content: '# Test' };
      (mockGithubTools.getFile as jest.Mock).mockResolvedValue(fileData);

      const result = await service.executeTool('github_get_file', {
        repo_url: 'https://github.com/owner/repo',
        file_path: 'README.md',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(fileData);
    });

    it('should execute github_get_test_results tool', async () => {
      const testData = { status: 'success', passed: 100 };
      (mockGithubTools.getTestResults as jest.Mock).mockResolvedValue(testData);

      const result = await service.executeTool('github_get_test_results', {
        repo_url: 'https://github.com/owner/repo',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
    });

    it('should execute web_search tool', async () => {
      const searchData = { results: [{ title: 'Result 1' }] };
      (mockWebTools.search as jest.Mock).mockResolvedValue(searchData);

      const result = await service.executeTool('web_search', {
        query: 'web3 startup',
        purpose: 'market_research',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(searchData);
    });

    it('should execute url_fetch tool', async () => {
      const fetchData = { url: 'https://example.com', content: 'Test content' };
      (mockWebTools.fetchUrl as jest.Mock).mockResolvedValue(fetchData);

      const result = await service.executeTool('url_fetch', {
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(fetchData);
    });

    it('should execute contract_read tool', async () => {
      const contractData = { result: '0x123' };
      (mockBlockchainTools.readContract as jest.Mock).mockResolvedValue(contractData);

      const result = await service.executeTool('contract_read', {
        chain: 'mantle',
        contract: '0x123',
        method: 'totalSupply',
        args: [],
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(contractData);
    });

    it('should execute get_funding_pool_state tool', async () => {
      const poolData = { raisedAmount: '1000000', softCap: '500000' };
      (mockBlockchainTools.getFundingPoolState as jest.Mock).mockResolvedValue(poolData);

      const result = await service.executeTool('get_funding_pool_state', {
        chain: 'mantle',
        ideaId: '1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(poolData);
    });

    it('should execute ipfs_pin_reasoning tool', async () => {
      const pinData = { success: true, ipfsHash: 'QmTestHash' };
      (mockIpfsTools.pinReasoning as jest.Mock).mockResolvedValue(pinData);

      const result = await service.executeTool('ipfs_pin_reasoning', {
        content: 'Test reasoning',
        metadata: { type: 'test' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(pinData);
    });

    it('should return error for unknown tool', async () => {
      const result = await service.executeTool('unknown_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle tool execution errors', async () => {
      (mockGithubTools.getRepo as jest.Mock).mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await service.executeTool('github_get_repo', { repo_url: 'https://github.com/owner/repo' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit exceeded');
      expect(result.toolName).toBe('github_get_repo');
    });

    it('should include timestamp in result', async () => {
      (mockGithubTools.getRepo as jest.Mock).mockResolvedValue({ name: 'test' });

      const result = await service.executeTool('github_get_repo', { repo_url: 'https://github.com/owner/repo' });

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('executeToolsInParallel', () => {
    it('should execute multiple tools in parallel', async () => {
      const repoData = { name: 'test-repo' };
      const searchData = { results: [{ title: 'Result' }] };

      (mockGithubTools.getRepo as jest.Mock).mockResolvedValue(repoData);
      (mockWebTools.search as jest.Mock).mockResolvedValue(searchData);

      const tools = [
        { name: 'github_get_repo', params: { repo_url: 'https://github.com/owner/repo' } },
        { name: 'web_search', params: { query: 'test', purpose: 'general' } },
      ];

      const results = await service.executeToolsInParallel(tools);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].data).toEqual(repoData);
      expect(results[1].success).toBe(true);
      expect(results[1].data).toEqual(searchData);
    });

    it('should handle mixed success and failure in parallel', async () => {
      (mockGithubTools.getRepo as jest.Mock).mockResolvedValue({ name: 'test-repo' });
      (mockWebTools.search as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const tools = [
        { name: 'github_get_repo', params: { repo_url: 'https://github.com/owner/repo' } },
        { name: 'web_search', params: { query: 'test', purpose: 'general' } },
      ];

      const results = await service.executeToolsInParallel(tools);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Search failed');
    });

    it('should handle empty tool list', async () => {
      const results = await service.executeToolsInParallel([]);

      expect(results).toHaveLength(0);
    });
  });
});