import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { GithubTools } from './github.tools';
import { WebTools } from './web.tools';
import { BlockchainTools } from './blockchain.tools';
import { IpfsTools } from './ipfs.tools';

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  toolName: string;
  timestamp: Date;
}

@Injectable()
export class ToolsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly githubTools: GithubTools,
    private readonly webTools: WebTools,
    private readonly blockchainTools: BlockchainTools,
    private readonly ipfsTools: IpfsTools,
  ) {}

  /**
   * Execute a tool by name with given parameters
   */
  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (toolName) {
        // GitHub Tools
        case 'github_get_repo':
          result = await this.githubTools.getRepo(params.repo_url as string);
          break;
        case 'github_get_commits':
          result = await this.githubTools.getCommits(
            params.repo_url as string,
            params.since_date as string,
            params.until_date as string | undefined,
          );
          break;
        case 'github_get_file':
          result = await this.githubTools.getFile(
            params.repo_url as string,
            params.file_path as string,
          );
          break;
        case 'github_get_test_results':
          result = await this.githubTools.getTestResults(params.repo_url as string);
          break;

        // Web Tools
        case 'web_search':
          result = await this.webTools.search(
            params.query as string,
            params.purpose as string,
          );
          break;
        case 'url_fetch':
          result = await this.webTools.fetchUrl(
            params.url as string,
            params.check_type as string | undefined,
          );
          break;

        // Blockchain Tools
        case 'contract_read':
          result = await this.blockchainTools.readContract(
            params.chain as string,
            params.contract as string,
            params.method as string,
            params.args as string[],
          );
          break;
        case 'get_funding_pool_state':
          result = await this.blockchainTools.getFundingPoolState(
            params.chain as string,
            params.ideaId as string,
          );
          break;

        // IPFS Tools
        case 'ipfs_pin_reasoning':
          result = await this.ipfsTools.pinReasoning(
            params.content as string,
            params.metadata as Record<string, unknown>,
          );
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return {
        success: true,
        data: result,
        toolName,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        toolName,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeToolsInParallel(
    tools: Array<{ name: string; params: Record<string, unknown> }>,
  ): Promise<ToolResult[]> {
    const promises = tools.map((tool) => this.executeTool(tool.name, tool.params));
    return Promise.all(promises);
  }
}