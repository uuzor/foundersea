import { Test, TestingModule } from '@nestjs/testing';
import { WebTools } from './web.tools';
import { ConfigService } from '../config/config.service';

describe('WebTools', () => {
  let tools: WebTools;

  const createMockConfigService = (apiKey?: string): ConfigService => ({
    serperApiKey: apiKey ?? 'test-serper-api-key',
  } as unknown as ConfigService);

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should throw error when Serper API key not configured', async () => {
      const mockConfig = createMockConfigService('');
      const tools = new WebTools(mockConfig);
      await expect(tools.search('test query', 'general')).rejects.toThrow('Serper API key not configured');
    });

    it('should return search results from Serper API', async () => {
      const mockConfig = createMockConfigService();
      const tools = new WebTools(mockConfig);

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          organic: [
            { title: 'Result 1', link: 'https://example.com/1', snippet: 'Snippet 1' },
            { title: 'Result 2', link: 'https://example.com/2', snippet: 'Snippet 2' },
          ],
        }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await tools.search('test query', 'market_research');

      expect(result.query).toBe('test query');
      expect(result.purpose).toBe('market_research');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('Result 1');
      expect(result.totalResults).toBe(2);

      jest.restoreAllMocks();
    });

    it('should handle API errors gracefully', async () => {
      const mockConfig = createMockConfigService();
      const tools = new WebTools(mockConfig);

      const mockResponse = {
        ok: false,
        status: 400,
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      await expect(tools.search('test query', 'general')).rejects.toThrow('Serper API error: 400');

      jest.restoreAllMocks();
    });
  });

  describe('fetchUrl', () => {
    it('should fetch URL content successfully', async () => {
      const mockConfig = createMockConfigService();
      const tools = new WebTools(mockConfig);

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('text/html'),
        },
        text: jest.fn().mockResolvedValue('<html><body>Test content</body></html>'),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await tools.fetchUrl('https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(result.status).toBe(200);
      expect(result.isAvailable).toBe(true);
      expect(result.contentType).toBe('text/html');

      jest.restoreAllMocks();
    });

    it('should return unavailable status on fetch error', async () => {
      const mockConfig = createMockConfigService();
      const tools = new WebTools(mockConfig);

      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await tools.fetchUrl('https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(result.status).toBe(0);
      expect(result.isAvailable).toBe(false);
      expect(result.contentType).toBe('error');

      jest.restoreAllMocks();
    });

    it('should handle non-200 status codes', async () => {
      const mockConfig = createMockConfigService();
      const tools = new WebTools(mockConfig);

      const mockResponse = {
        ok: false,
        status: 404,
        headers: {
          get: jest.fn().mockReturnValue('text/html'),
        },
        text: jest.fn().mockResolvedValue('Not Found'),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await tools.fetchUrl('https://example.com/not-found');

      expect(result.status).toBe(404);
      expect(result.isAvailable).toBe(false);

      jest.restoreAllMocks();
    });
  });
});