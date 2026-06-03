"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const github_tools_1 = require("./github.tools");
const web_tools_1 = require("./web.tools");
const blockchain_tools_1 = require("./blockchain.tools");
const ipfs_tools_1 = require("./ipfs.tools");
let ToolsService = class ToolsService {
    constructor(configService, githubTools, webTools, blockchainTools, ipfsTools) {
        this.configService = configService;
        this.githubTools = githubTools;
        this.webTools = webTools;
        this.blockchainTools = blockchainTools;
        this.ipfsTools = ipfsTools;
    }
    async executeTool(toolName, params) {
        const startTime = Date.now();
        try {
            let result;
            switch (toolName) {
                case 'github_get_repo':
                    result = await this.githubTools.getRepo(params.repo_url);
                    break;
                case 'github_get_commits':
                    result = await this.githubTools.getCommits(params.repo_url, params.since_date, params.until_date);
                    break;
                case 'github_get_file':
                    result = await this.githubTools.getFile(params.repo_url, params.file_path);
                    break;
                case 'github_get_test_results':
                    result = await this.githubTools.getTestResults(params.repo_url);
                    break;
                case 'web_search':
                    result = await this.webTools.search(params.query, params.purpose);
                    break;
                case 'url_fetch':
                    result = await this.webTools.fetchUrl(params.url, params.check_type);
                    break;
                case 'contract_read':
                    result = await this.blockchainTools.readContract(params.chain, params.contract, params.method, params.args);
                    break;
                case 'get_funding_pool_state':
                    result = await this.blockchainTools.getFundingPoolState(params.chain, params.ideaId);
                    break;
                case 'ipfs_pin_reasoning':
                    result = await this.ipfsTools.pinReasoning(params.content, params.metadata);
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
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                toolName,
                timestamp: new Date(),
            };
        }
    }
    async executeToolsInParallel(tools) {
        const promises = tools.map((tool) => this.executeTool(tool.name, tool.params));
        return Promise.all(promises);
    }
};
exports.ToolsService = ToolsService;
exports.ToolsService = ToolsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        github_tools_1.GithubTools,
        web_tools_1.WebTools,
        blockchain_tools_1.BlockchainTools,
        ipfs_tools_1.IpfsTools])
], ToolsService);
//# sourceMappingURL=tools.service.js.map