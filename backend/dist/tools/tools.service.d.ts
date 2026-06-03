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
export declare class ToolsService {
    private readonly configService;
    private readonly githubTools;
    private readonly webTools;
    private readonly blockchainTools;
    private readonly ipfsTools;
    constructor(configService: ConfigService, githubTools: GithubTools, webTools: WebTools, blockchainTools: BlockchainTools, ipfsTools: IpfsTools);
    executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolResult>;
    executeToolsInParallel(tools: Array<{
        name: string;
        params: Record<string, unknown>;
    }>): Promise<ToolResult[]>;
}
