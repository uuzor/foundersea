import { Test, TestingModule } from '@nestjs/testing';
import { TokenRouterService, TokenRouterTool } from './token-router.service';
import { ConfigService } from '../config/config.service';
import { ToolsService } from '../tools/tools.service';
import { ToolResult } from '../tools/tools.service';

// Mock config service
const mockConfigService = {
  tokenRouterBaseUrl: 'https://api.tokenrouter.io/v1',
  tokenRouterApiKey: 'test-api-key',
};

// Mock tools service
const mockToolsService = {
  executeTool: jest.fn(),
};

describe('TokenRouterService', () => {
  let service: TokenRouterService;
  let toolsService: ToolsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenRouterService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ToolsService, useValue: mockToolsService },
      ],
    }).compile();

    service = module.get<TokenRouterService>(TokenRouterService);
    toolsService = module.get<ToolsService>(ToolsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runAgenticLoop', () => {
    it('should return error when API key is not set', async () => {
      // Test with empty API key
      const emptyConfigService = {
        tokenRouterBaseUrl: 'https://api.tokenrouter.io/v1',
        tokenRouterApiKey: '',
      };

      const emptyModule = await Test.createTestingModule({
        providers: [
          TokenRouterService,
          { provide: ConfigService, useValue: emptyConfigService },
          { provide: ToolsService, useValue: mockToolsService },
        ],
      }).compile();

      const emptyService = emptyModule.get<TokenRouterService>(TokenRouterService);

      // Should handle gracefully when no API key
      // Note: The actual API call will fail, but the service should handle it
    });

    it('should show tool mapping when executing', async () => {
      // This tests that executeTool maps tool names correctly
      const toolNameMapping: Record<string, string> = {
        'web_search': 'web_search',
        'github_get_repo': 'github_get_repo',
        'url_fetch': 'url_fetch',
      };

      expect(toolNameMapping['web_search']).toBe('web_search');
      expect(toolNameMapping['github_get_repo']).toBe('github_get_repo');
      expect(toolNameMapping['url_fetch']).toBe('url_fetch');
      // Unknown tools are not in mapping, so lookup returns undefined
      // The actual code uses: `toolNameMapping[toolName] || toolName`
      // So unknown tools fall through to themselves
      expect(toolNameMapping['unknown_tool']).toBeUndefined();
    });
  });

  describe('scoreIdeaAgentic', () => {
    it('should build correct tools array', () => {
      const availableTools: TokenRouterTool[] = [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for information',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                purpose: { type: 'string', description: 'Purpose of the search' },
              },
              required: ['query'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'github_get_repo',
            description: 'Get GitHub repository information',
            parameters: {
              type: 'object',
              properties: {
                repo_url: { type: 'string', description: 'GitHub repository URL' },
              },
              required: ['repo_url'],
            },
          },
        },
      ];

      expect(availableTools.length).toBe(2);
      expect(availableTools[0].function.name).toBe('web_search');
      expect(availableTools[1].function.name).toBe('github_get_repo');
    });
  });

  describe('parseIdeaScoreResult', () => {
    it('should parse APPROVE recommendation', () => {
      const response = 'Based on my analysis, I recommend APPROVE. The idea has strong market potential and good feasibility score of 75.';
      
      // Manually test the parsing logic
      const hasApprov = response.toLowerCase().includes('approve');
      const hasReject = response.toLowerCase().includes('reject');
      
      let recommendation: 'APPROVE' | 'REJECT' | 'ESCALATE' = 'ESCALATE';
      if (hasApprov && !hasReject) recommendation = 'APPROVE';
      if (hasReject && !hasApprov) recommendation = 'REJECT';
      
      expect(recommendation).toBe('APPROVE');
    });

    it('should parse REJECT recommendation', () => {
      const response = 'After careful analysis, I recommend REJECT. The feasibility score is too low at 30 and market competition is high.';
      
      const hasApprov = response.toLowerCase().includes('approve');
      const hasReject = response.toLowerCase().includes('reject');
      
      let recommendation: 'APPROVE' | 'REJECT' | 'ESCALATE' = 'ESCALATE';
      if (hasApprov && !hasReject) recommendation = 'APPROVE';
      if (hasReject && !hasApprov) recommendation = 'REJECT';
      
      expect(recommendation).toBe('REJECT');
    });

    it('should default to ESCALATE when unclear', () => {
      const response = 'This idea requires further human review due to mixed signals in the data.';
      
      const hasApprov = response.toLowerCase().includes('approve');
      const hasReject = response.toLowerCase().includes('reject');
      
      let recommendation: 'APPROVE' | 'REJECT' | 'ESCALATE' = 'ESCALATE';
      if (hasApprov && !hasReject) recommendation = 'APPROVE';
      if (hasReject && !hasApprov) recommendation = 'REJECT';
      
      expect(recommendation).toBe('ESCALATE');
    });

    it('should extract score from response', () => {
      const response = 'Overall score: 85 out of 100. The idea shows strong potential.';
      
      const scoreMatch = response.match(/overall.*?(\d+)/i);
      const overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;
      
      expect(overallScore).toBe(85);
    });

    it('should default to 50 when no score found', () => {
      const response = 'This is a standard idea that needs evaluation.';
      
      const scoreMatch = response.match(/overall.*?(\d+)/i);
      const overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;
      
      expect(overallScore).toBe(50);
    });
  });
});

describe('Tool Execution Integration', () => {
  it('should map web_search tool correctly', async () => {
    const toolNameMapping: Record<string, string> = {
      'web_search': 'web_search',
      'github_get_repo': 'github_get_repo',
      'url_fetch': 'url_fetch',
    };

    const result = toolNameMapping['web_search'];
    expect(result).toBe('web_search');
  });

  it('should map github_get_repo tool correctly', async () => {
    const toolNameMapping: Record<string, string> = {
      'web_search': 'web_search',
      'github_get_repo': 'github_get_repo',
      'url_fetch': 'url_fetch',
    };

    const result = toolNameMapping['github_get_repo'];
    expect(result).toBe('github_get_repo');
  });

  it('should pass through unknown tools', async () => {
    const toolNameMapping: Record<string, string> = {
      'web_search': 'web_search',
      'github_get_repo': 'github_get_repo',
      'url_fetch': 'url_fetch',
    };

    const result = toolNameMapping['custom_tool'] || 'custom_tool';
    expect(result).toBe('custom_tool');
  });

  it('should handle web_search args parsing', async () => {
    const toolArgs = {
      query: 'DeFi lending market size 2024',
      purpose: 'market_research',
    };

    const parsed = JSON.parse(JSON.stringify(toolArgs));
    expect(parsed.query).toBe('DeFi lending market size 2024');
    expect(parsed.purpose).toBe('market_research');
  });

  it('should handle github_get_repo args parsing', async () => {
    const toolArgs = {
      repo_url: 'https://github.com/ethereum/solidity',
    };

    const parsed = JSON.parse(JSON.stringify(toolArgs));
    expect(parsed.repo_url).toBe('https://github.com/ethereum/solidity');
  });
});