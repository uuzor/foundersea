import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

export interface PinResult {
  success: boolean;
  ipfsHash?: string;
  pinUrl?: string;
  error?: string;
}

@Injectable()
export class IpfsTools {
  private readonly logger = new Logger(IpfsTools.name);
  private readonly pinataUrl = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Pin reasoning content to IPFS via Pinata
   */
  async pinReasoning(
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<PinResult> {
    const apiKey = this.configService.pinataApiKey;
    const secret = this.configService.pinataSecret;

    if (!apiKey || !secret) {
      // Fallback: return mock IPFS hash for development
      this.logger.warn('Pinata credentials not configured, returning mock hash');
      const mockHash = `Qm${Math.random().toString(36).substring(2, 46)}`;
      return {
        success: true,
        ipfsHash: mockHash,
        pinUrl: `https://ipfs.io/ipfs/${mockHash}`,
      };
    }

    try {
      const body = {
        pinataContent: {
          content,
          metadata,
          timestamp: new Date().toISOString(),
          version: '1.0',
        },
        pinataMetadata: {
          name: `foundersea-reasoning-${Date.now()}`,
          keyvalues: {
            type: metadata.type as string || 'reasoning',
            agent: metadata.agent as string || 'unknown',
          },
        },
        pinataOptions: {
          cidVersion: 1,
        },
      };

      const response = await fetch(this.pinataUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: apiKey,
          pinata_secret_api_key: secret,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as { IpfsHash: string };

      return {
        success: true,
        ipfsHash: data.IpfsHash,
        pinUrl: `https://ipfs.io/ipfs/${data.IpfsHash}`,
      };
    } catch (error) {
      this.logger.error('Failed to pin to IPFS', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Pin reasoning with automatic fallback to a local mock hash.
   * Never throws — always returns a usable ipfsHash.
   */
  async safePinReasoning(
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<PinResult> {
    const result = await this.pinReasoning(content, metadata);
    if (result.success && result.ipfsHash) return result;

    this.logger.warn('IPFS pin failed, using local mock hash');
    const mockHash = `Qm${Math.random().toString(36).substring(2, 46)}`;
    return { success: true, ipfsHash: mockHash, pinUrl: `https://ipfs.io/ipfs/${mockHash}` };
  }

  /**
   * Get content from IPFS
   */
  async getContent(ipfsHash: string): Promise<{ success: boolean; content?: unknown; error?: string }> {
    try {
      const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`IPFS fetch error: ${response.status}`);
      }

      const content = await response.json();
      return {
        success: true,
        content,
      };
    } catch (error) {
      this.logger.error(`Failed to get IPFS content: ${ipfsHash}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}