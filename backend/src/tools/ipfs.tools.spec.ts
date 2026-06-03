import { Test, TestingModule } from '@nestjs/testing';
import { IpfsTools } from './ipfs.tools';
import { ConfigService } from '../config/config.service';

describe('IpfsTools', () => {
  let tools: IpfsTools;

  const createMockConfigService = (apiKey?: string, secret?: string): ConfigService => ({
    pinataApiKey: apiKey ?? 'test-pinata-key',
    pinataSecret: secret ?? 'test-pinata-secret',
  } as unknown as ConfigService);

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('pinReasoning', () => {
    it('should return mock hash when Pinata credentials not configured', async () => {
      const mockConfig = createMockConfigService('', '');
      const tools = new IpfsTools(mockConfig);
      
      const result = await tools.pinReasoning('test content', { type: 'test' });

      expect(result.success).toBe(true);
      expect(result.ipfsHash).toBeDefined();
      expect(result.ipfsHash?.startsWith('Qm')).toBe(true);
      expect(result.pinUrl).toBeDefined();
    });

    it('should pin content to IPFS via Pinata', async () => {
      const mockConfig = createMockConfigService();
      const tools = new IpfsTools(mockConfig);

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ IpfsHash: 'QmTestHash123456789' }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await tools.pinReasoning('test reasoning content', {
        type: 'milestone_validation',
        milestoneId: '1',
      });

      expect(result.success).toBe(true);
      expect(result.ipfsHash).toBe('QmTestHash123456789');
      expect(result.pinUrl).toBe('https://ipfs.io/ipfs/QmTestHash123456789');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'pinata_api_key': 'test-pinata-key',
            'pinata_secret_api_key': 'test-pinata-secret',
          }),
        }),
      );

      jest.restoreAllMocks();
    });

    it('should handle Pinata API errors', async () => {
      const mockConfig = createMockConfigService();
      const tools = new IpfsTools(mockConfig);

      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await tools.pinReasoning('test content', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');

      jest.restoreAllMocks();
    });

    it('should handle network errors', async () => {
      const mockConfig = createMockConfigService();
      const tools = new IpfsTools(mockConfig);

      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await tools.pinReasoning('test content', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');

      jest.restoreAllMocks();
    });
  });

  describe('getContent', () => {
    it('should fetch content from IPFS', async () => {
      const mockContent = { test: 'data', timestamp: '2024-01-01' };
      const mockConfig = createMockConfigService();
      const tools = new IpfsTools(mockConfig);

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockContent),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await tools.getContent('QmTestHash');

      expect(result.success).toBe(true);
      expect(result.content).toEqual(mockContent);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://ipfs.io/ipfs/QmTestHash',
        expect.any(Object),
      );

      jest.restoreAllMocks();
    });

    it('should handle IPFS fetch errors', async () => {
      const mockConfig = createMockConfigService();
      const tools = new IpfsTools(mockConfig);

      const mockResponse = {
        ok: false,
        status: 404,
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await tools.getContent('QmNonExistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');

      jest.restoreAllMocks();
    });

    it('should handle network errors when fetching IPFS content', async () => {
      const mockConfig = createMockConfigService();
      const tools = new IpfsTools(mockConfig);

      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection timeout'));

      const result = await tools.getContent('QmTestHash');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');

      jest.restoreAllMocks();
    });
  });
});