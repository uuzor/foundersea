import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
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

@Injectable()
export class GithubTools {
  private readonly logger = new Logger(GithubTools.name);
  private octokit: Octokit | null = null;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.githubToken;
    if (token) {
      this.octokit = new Octokit({ auth: token });
    } else {
      this.logger.warn('GitHub token not configured - GitHub tools will return empty results');
    }
  }

  /** Check whether a GitHub error is a credentials failure */
  private isCredentialsError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return msg.includes('Bad credentials') || msg.includes('401') || msg.includes('Unauthorized');
  }

  /**
   * Extract owner and repo from URL
   */
  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    // Handle various URL formats
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

  /**
   * Get repository metadata
   */
  async getRepo(repoUrl: string): Promise<RepoMetadata> {
    if (!this.octokit) {
      throw new Error('GitHub token not configured');
    }

    // Pre-validate token to avoid cascading errors
    try {
      await this.octokit.rest.users.getAuthenticated();
    } catch (e) {
      if (this.isCredentialsError(e)) {
        this.logger.warn('GitHub token invalid or expired - returning empty repo metadata');
        return {
          name: '', fullName: repoUrl, description: null, stars: 0,
          forks: 0, language: null, lastCommitDate: '', openIssues: 0,
          url: repoUrl, topics: [], readme: null,
        };
      }
    }

    try {
      const { owner, repo } = this.parseRepoUrl(repoUrl);

      const [repoData, readmeData] = await Promise.all([
        this.octokit.repos.get({ owner, repo }),
        this.octokit.repos.getReadme({ owner, repo }).catch(() => null),
      ]);

      // Get last commit
      const commits = await this.octokit.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });

      // Get topics
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
    } catch (error) {
      this.logger.error(`Failed to get repo: ${repoUrl}`, error);
      throw error;
    }
  }

  /**
   * Get commits since a given date
   */
  async getCommits(
    repoUrl: string,
    sinceDate: string,
    untilDate?: string,
  ): Promise<CommitInfo[]> {
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
    } catch (error) {
      if (this.isCredentialsError(error)) {
        this.logger.warn('GitHub token invalid - returning empty commits');
        return [];
      }
      this.logger.error(`Failed to get commits: ${repoUrl}`, error);
      return [];
    }
  }

  /**
   * Get a specific file from a repository
   */
  async getFile(repoUrl: string, filePath: string): Promise<FileContent> {
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
    } catch (error) {
      this.logger.error(`Failed to get file: ${repoUrl}/${filePath}`, error);
      throw error;
    }
  }

  /**
   * Get test results from GitHub Actions
   */
  async getTestResults(repoUrl: string): Promise<TestResults> {
    if (!this.octokit) {
      throw new Error('GitHub token not configured');
    }

    const emptyResult: TestResults = {
      totalRuns: 0, passed: 0, failed: 0, coverage: null,
      workflowName: 'unknown', status: 'cancelled', lastRunDate: '',
    };

    try {
      const { owner, repo } = this.parseRepoUrl(repoUrl);

      // Get workflow runs
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

      // Get jobs for the latest run
      const jobs = await this.octokit.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: latestRun.id,
      });

      let passed = 0;
      let failed = 0;
      let coverage: number | null = null;

      for (const job of jobs.data.jobs) {
        if (job.conclusion === 'success') {
          passed++;
        } else if (job.conclusion === 'failure') {
          failed++;
        }
      }

      // Try to get coverage from job summary
      for (const job of jobs.data.jobs) {
        if (job.steps) {
          for (const step of job.steps) {
            if (step.name.toLowerCase().includes('coverage')) {
              // Coverage would be extracted from step logs in production
              coverage = null; // Placeholder
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
    } catch (error) {
      if (this.isCredentialsError(error)) {
        this.logger.warn('GitHub token invalid - returning empty test results');
        return emptyResult;
      }
      this.logger.error(`Failed to get test results: ${repoUrl}`, error);
      return emptyResult;
    }
  }
}