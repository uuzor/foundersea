import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  purpose: string;
  results: SearchResult[];
  totalResults: number;
}

export interface UrlFetchResponse {
  url: string;
  status: number;
  content: string;
  contentType: string;
  isAvailable: boolean;
  matchedContent?: string[];
}

@Injectable()
export class WebTools {
  private readonly logger = new Logger(WebTools.name);
  private readonly serperUrl = 'https://google.serper.dev/search';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Search the web using Serper API
   */
  async search(query: string, purpose: string): Promise<SearchResponse> {
    const apiKey = this.configService.serperApiKey;

    if (!apiKey) {
      throw new Error('Serper API key not configured');
    }

    try {
      const response = await fetch(this.serperUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query }),
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data = await response.json() as {
        organic?: Array<{ title: string; link: string; snippet: string }>;
      };

      const results: SearchResult[] = (data.organic || []).slice(0, 10).map((item) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
      }));

      return {
        query,
        purpose,
        results,
        totalResults: results.length,
      };
    } catch (error) {
      this.logger.error(`Failed to search: ${query}`, error);
      throw error;
    }
  }

  /**
   * Fetch URL content
   */
  async fetchUrl(url: string, checkType?: string): Promise<UrlFetchResponse> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FounderSea/1.0',
          'Accept': 'text/html,application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      const contentType = response.headers.get('content-type') || 'unknown';
      let content = '';

      if (contentType.includes('text/html')) {
        const html = await response.text();
        // Extract text content (simple approach)
        content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 10000);
      } else if (contentType.includes('application/json')) {
        const json = await response.json();
        content = JSON.stringify(json).substring(0, 10000);
      } else {
        content = await response.text();
      }

      const result: UrlFetchResponse = {
        url,
        status: response.status,
        content: content.substring(0, 5000),
        contentType,
        isAvailable: response.ok,
      };

      // Check content if requested
      if (checkType === 'content_match' && result.isAvailable) {
        result.matchedContent = [];
        // Would implement content matching logic here
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch URL: ${url}`, error);
      return {
        url,
        status: 0,
        content: '',
        contentType: 'error',
        isAvailable: false,
      };
    }
  }
}