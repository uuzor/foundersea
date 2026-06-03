import { Test, TestingModule } from '@nestjs/testing';
import { GithubTools } from './github.tools';
import { ConfigService } from '../config/config.service';

// Mock the Octokit
jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      repos: {
        get: jest.fn(),
        getReadme: jest.fn(),
        listCommits: jest.fn(),
        getContent: jest.fn(),
      },
      actions: {
        listWorkflowRunsForRepo: jest.fn(),
        listJobsForWorkflowRun: jest.fn(),
      },
    })),
  };
});

describe('GithubTools', () => {
  let tools: GithubTools;

  const createMockConfigService = (token?: string): ConfigService => ({
    githubToken: token ?? 'test-token',
  } as unknown as ConfigService);

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseRepoUrl', () => {
    it('should parse standard GitHub URL', () => {
      const mockConfig = createMockConfigService();
      const tools = new GithubTools(mockConfig);
      const result = (tools as any).parseRepoUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse GitHub URL with .git extension', () => {
      const mockConfig = createMockConfigService();
      const tools = new GithubTools(mockConfig);
      const result = (tools as any).parseRepoUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse short owner/repo format', () => {
      const mockConfig = createMockConfigService();
      const tools = new GithubTools(mockConfig);
      const result = (tools as any).parseRepoUrl('owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should handle nested paths', () => {
      const mockConfig = createMockConfigService();
      const tools = new GithubTools(mockConfig);
      const result = (tools as any).parseRepoUrl('https://github.com/owner/repo/tree/main/src');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should throw error for invalid URL', () => {
      const mockConfig = createMockConfigService();
      const tools = new GithubTools(mockConfig);
      expect(() => (tools as any).parseRepoUrl('invalid-url')).toThrow('Invalid GitHub URL');
    });
  });

  describe('getRepo', () => {
    it('should throw error when GitHub token not configured', async () => {
      const mockConfig = createMockConfigService('');
      const tools = new GithubTools(mockConfig);
      await expect(tools.getRepo('https://github.com/owner/repo')).rejects.toThrow('GitHub token not configured');
    });
  });
});