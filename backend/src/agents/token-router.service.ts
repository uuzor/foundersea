import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import axios, { AxiosInstance } from 'axios';

export interface TokenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenRouterRequest {
  model: string;
  messages: TokenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: TokenRouterTool[];
  tool_choice?: string;
}

export interface TokenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface TokenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ToolCallResult {
  toolName: string;
  success: boolean;
  result: unknown;
  error?: string;
}

@Injectable()
export class TokenRouterService {
  private readonly logger = new Logger(TokenRouterService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.tokenRouterBaseUrl;
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.configService.tokenRouterApiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Execute a chat completion with TokenRouter
   */
  async chat(request: TokenRouterRequest): Promise<TokenRouterResponse> {
    try {
      const response = await this.httpClient.post(
        '/chat/completions',
        request,
        { headers: this.getHeaders() }
      );
      return response.data as TokenRouterResponse;
    } catch (error) {
      this.logger.error(`TokenRouter API error: ${error}`);
      throw error;
    }
  }

  /**
   * Execute an agentic loop with tool calling
   * This replaces hardcoded agent scripts with an LLM-driven approach
   */
  async runAgenticLoop(params: {
    systemPrompt: string;
    userMessage: string;
    availableTools: TokenRouterTool[];
    maxIterations?: number;
    context?: Record<string, unknown>;
  }): Promise<{
    finalResponse: string;
    toolCalls: ToolCallResult[];
    iterations: number;
  }> {
    const maxIterations = params.maxIterations || 5;
    const toolCalls: ToolCallResult[] = [];
    let iteration = 0;
    let messages: TokenRouterMessage[] = [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userMessage },
    ];

    while (iteration < maxIterations) {
      iteration++;
      this.logger.log(`Agentic loop iteration ${iteration}/${maxIterations}`);

      try {
        const response = await this.chat({
          model: 'anthropic/claude-3-5-sonnet',
          messages,
          tools: params.availableTools,
          tool_choice: 'auto',
        });

        const choice = response.choices[0];
        
        // If no tool calls, return the final response
        if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
          return {
            finalResponse: choice.message.content || '',
            toolCalls,
            iterations: iteration,
          };
        }

        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: choice.message.content || '',
        });

        // Process each tool call
        for (const toolCall of choice.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          this.logger.log(`Tool call: ${toolName} with args: ${JSON.stringify(toolArgs)}`);
          
          // Execute the tool (this would be wired to your tools service)
          const result = await this.executeTool(toolName, toolArgs);
          toolCalls.push({
            toolName,
            success: result.success,
            result: result.data,
            error: result.error,
          });

          // Add tool result to messages
          messages.push({
            role: 'user',
            content: JSON.stringify({
              tool_call_id: toolCall.id,
              name: toolName,
              content: result.success 
                ? JSON.stringify(result.data) 
                : `Error: ${result.error}`,
            }),
          });
        }
      } catch (error) {
        this.logger.error(`Agentic loop error at iteration ${iteration}: ${error}`);
        return {
          finalResponse: `Error during agentic loop: ${error instanceof Error ? error.message : 'Unknown error'}`,
          toolCalls,
          iterations: iteration,
        };
      }
    }

    return {
      finalResponse: 'Maximum iterations reached without final response',
      toolCalls,
      iterations: iteration,
    };
  }

  /**
   * Execute a tool by name
   * This should be wired to your ToolsService
   */
  private async executeTool(toolName: string, args: Record<string, unknown>): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    // Tool execution would be wired to ToolsService
    // For now, return a placeholder response
    this.logger.log(`Executing tool: ${toolName}`);
    
    return {
      success: true,
      data: { message: `Tool ${toolName} executed with args: ${JSON.stringify(args)}` },
    };
  }

  /**
   * Run idea scoring via TokenRouter agentic loop
   */
  async scoreIdeaAgentic(params: {
    ideaId: string;
    title: string;
    description: string;
    marketCategory: string;
    chain: string;
  }): Promise<{
    recommendation: 'APPROVE' | 'REJECT' | 'ESCALATE';
    overallScore: number;
    confidence: number;
    reasoning: string;
  }> {
    const systemPrompt = `You are a Web3 venture analyst for FounderSea protocol.
Your decision controls whether a funding round opens.
Token holders' capital is at stake. Be rigorous. Reject weak ideas.

You have access to tools:
- web_search: Search the web for market data
- github_get_repo: Get repository information  
- url_fetch: Check URL availability

Analyze the idea thoroughly and provide a recommendation.`;

    const userMessage = `Score this idea:
- ID: ${params.ideaId}
- Title: ${params.title}
- Description: ${params.description}
- Category: ${params.marketCategory}
- Chain: ${params.chain}

Use your tools to research the market before scoring.`;

    const availableTools: TokenRouterTool[] = [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              purpose: { type: 'string', description: 'Purpose of the search' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'github_get_repo',
          description: 'Get GitHub repository information',
          parameters: {
            type: 'object',
            properties: {
              repo_url: { type: 'string', description: 'GitHub repository URL' },
            },
            required: ['repo_url'],
          },
        },
      },
    ];

    const result = await this.runAgenticLoop({
      systemPrompt,
      userMessage,
      availableTools,
      maxIterations: 5,
    });

    // Parse the final response to extract scores
    // In production, this would be more sophisticated
    return this.parseIdeaScoreResult(result.finalResponse);
  }

  private parseIdeaScoreResult(response: string): {
    recommendation: 'APPROVE' | 'REJECT' | 'ESCALATE';
    overallScore: number;
    confidence: number;
    reasoning: string;
  } {
    // Simple parsing - in production use structured output
    const hasApprov = response.toLowerCase().includes('approve');
    const hasReject = response.toLowerCase().includes('reject');
    
    let recommendation: 'APPROVE' | 'REJECT' | 'ESCALATE' = 'ESCALATE';
    if (hasApprov && !hasReject) recommendation = 'APPROVE';
    if (hasReject && !hasApprov) recommendation = 'REJECT';

    // Extract score if present
    const scoreMatch = response.match(/overall.*?(\d+)/i);
    const overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;

    return {
      recommendation,
      overallScore,
      confidence: 75,
      reasoning: response,
    };
  }
}