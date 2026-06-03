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
var GithubTools_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubTools = void 0;
const common_1 = require("@nestjs/common");
const rest_1 = require("@octokit/rest");
const config_service_1 = require("../config/config.service");
let GithubTools = GithubTools_1 = class GithubTools {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(GithubTools_1.name);
        this.octokit = null;
        const token = this.configService.githubToken;
        if (token) {
            this.octokit = new rest_1.Octokit({ auth: token });
        }
    }
    parseRepoUrl(repoUrl) {
        const patterns = [
            /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
            /^([^\/]+)\/([^\/]+)$/,
        ];
        for (const pattern of patterns) {
            const match = repoUrl.match(pattern);
            if (match) {
                return { owner: match[1], repo: match[2].replace('.git', '') };
            }
        }
        throw new Error(`Invalid GitHub URL: ${repoUrl}`);
    }
    async getRepo(repoUrl) {
        if (!this.octokit) {
            throw new Error('GitHub token not configured');
        }
        try {
            const { owner, repo } = this.parseRepoUrl(repoUrl);
            const [repoData, readmeData] = await Promise.all([
                this.octokit.repos.get({ owner, repo }),
                this.octokit.repos.getReadme({ owner, repo }).catch(() => null),
            ]);
            const commits = await this.octokit.repos.listCommits({
                owner,
                repo,
                per_page: 1,
            });
            const topics = await this.octokit.repos.getAllTopics({ owner, repo }).catch(() => ({ data: { names: [] } }));
            const readme = readmeData
                ? Buffer.from(readmeData.data.content, 'base64').toString('utf-8').substring(0, 5000)
                : null;
            return {
                name: repoData.data.name,
                fullName: repoData.data.full_name,
                description: repoData.data.description,
                stars: repoData.data.stargazers_count,
                forks: repoData.data.forks_count,
                language: repoData.data.language,
                lastCommitDate: commits.data[0]?.commit.author?.date || '',
                openIssues: repoData.data.open_issues_count,
                url: repoData.data.html_url,
                topics: topics.data.names || [],
                readme,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get repo: ${repoUrl}`, error);
            throw error;
        }
    }
    async getCommits(repoUrl, sinceDate, untilDate) {
        if (!this.octokit) {
            throw new Error('GitHub token not configured');
        }
        try {
            const { owner, repo } = this.parseRepoUrl(repoUrl);
            const commits = await this.octokit.repos.listCommits({
                owner,
                repo,
                since: new Date(sinceDate).toISOString(),
                until: untilDate ? new Date(untilDate).toISOString() : undefined,
                per_page: 100,
            });
            return commits.data.map((commit) => ({
                sha: commit.sha,
                message: commit.commit.message.split('\n')[0],
                author: commit.commit.author?.name || 'Unknown',
                date: commit.commit.author?.date || '',
            }));
        }
        catch (error) {
            this.logger.error(`Failed to get commits: ${repoUrl}`, error);
            throw error;
        }
    }
    async getFile(repoUrl, filePath) {
        if (!this.octokit) {
            throw new Error('GitHub token not configured');
        }
        try {
            const { owner, repo } = this.parseRepoUrl(repoUrl);
            const response = await this.octokit.repos.getContent({
                owner,
                repo,
                path: filePath,
            });
            if ('content' in response.data && response.data.content) {
                const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
                return {
                    path: filePath,
                    content,
                    size: response.data.size,
                };
            }
            throw new Error('File not found or is a directory');
        }
        catch (error) {
            this.logger.error(`Failed to get file: ${repoUrl}/${filePath}`, error);
            throw error;
        }
    }
    async getTestResults(repoUrl) {
        if (!this.octokit) {
            throw new Error('GitHub token not configured');
        }
        try {
            const { owner, repo } = this.parseRepoUrl(repoUrl);
            const runs = await this.octokit.actions.listWorkflowRunsForRepo({
                owner,
                repo,
                per_page: 1,
            });
            if (runs.data.workflow_runs.length === 0) {
                return {
                    totalRuns: 0,
                    passed: 0,
                    failed: 0,
                    coverage: null,
                    workflowName: 'No workflows found',
                    status: 'cancelled',
                    lastRunDate: '',
                };
            }
            const latestRun = runs.data.workflow_runs[0];
            const workflowName = latestRun.name;
            const jobs = await this.octokit.actions.listJobsForWorkflowRun({
                owner,
                repo,
                run_id: latestRun.id,
            });
            let passed = 0;
            let failed = 0;
            let coverage = null;
            for (const job of jobs.data.jobs) {
                if (job.conclusion === 'success') {
                    passed++;
                }
                else if (job.conclusion === 'failure') {
                    failed++;
                }
            }
            for (const job of jobs.data.jobs) {
                if (job.steps) {
                    for (const step of job.steps) {
                        if (step.name.toLowerCase().includes('coverage')) {
                            coverage = null;
                        }
                    }
                }
            }
            return {
                totalRuns: jobs.data.total_count,
                passed,
                failed,
                coverage,
                workflowName: workflowName || 'Unknown Workflow',
                status: latestRun.conclusion === 'success' ? 'success' :
                    latestRun.conclusion === 'failure' ? 'failure' :
                        latestRun.status === 'in_progress' ? 'in_progress' : 'cancelled',
                lastRunDate: latestRun.created_at,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get test results: ${repoUrl}`, error);
            throw error;
        }
    }
};
exports.GithubTools = GithubTools;
exports.GithubTools = GithubTools = GithubTools_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], GithubTools);
//# sourceMappingURL=github.tools.js.map