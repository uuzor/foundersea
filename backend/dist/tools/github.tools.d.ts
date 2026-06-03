import { ConfigService } from '../config/config.service';
export interface RepoMetadata {
    name: string;
    fullName: string;
    description: string | null;
    stars: number;
    forks: number;
    language: string | null;
    lastCommitDate: string;
    openIssues: number;
    url: string;
    topics: string[];
    readme: string | null;
}
export interface CommitInfo {
    sha: string;
    message: string;
    author: string;
    date: string;
}
export interface FileContent {
    path: string;
    content: string;
    size: number;
}
export interface TestResults {
    totalRuns: number;
    passed: number;
    failed: number;
    coverage: number | null;
    workflowName: string;
    status: 'success' | 'failure' | 'in_progress' | 'cancelled';
    lastRunDate: string;
}
export declare class GithubTools {
    private readonly configService;
    private readonly logger;
    private octokit;
    constructor(configService: ConfigService);
    private parseRepoUrl;
    getRepo(repoUrl: string): Promise<RepoMetadata>;
    getCommits(repoUrl: string, sinceDate: string, untilDate?: string): Promise<CommitInfo[]>;
    getFile(repoUrl: string, filePath: string): Promise<FileContent>;
    getTestResults(repoUrl: string): Promise<TestResults>;
}
