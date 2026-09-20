import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { AgentReviewResult, ReviewOptions } from '../types/index.js';
import { LLMProvider } from '../providers/types.js';
import { DiffChunk } from '../git/chunker.js';
import { BaseAgent } from './base-agent.js';
import { SecuritySentinelAgent } from './security-sentinel.js';
import { LogicHoundAgent } from './logic-hound.js';
import { PerformanceCriticAgent } from './performance-critic.js';

export interface MultiAgentRunnerOptions {
  provider: LLMProvider;
  model?: string;
  enabledAgents?: string[];
  verbose?: boolean;
  customPrompt?: string;
  customRules?: Array<{ id: string; name: string; description: string; severity?: string }>;
  customAgents?: BaseAgent[];
}

export class MultiAgentRunner {
  private agents: BaseAgent[] = [];
  private provider: LLMProvider;
  private model?: string;
  private verbose: boolean;
  private customPrompt?: string;
  private customRules?: Array<{ id: string; name: string; description: string; severity?: string }>;

  constructor(options: MultiAgentRunnerOptions) {
    this.provider = options.provider;
    this.model = options.model;
    this.verbose = !!options.verbose;
    this.customPrompt = options.customPrompt;
    this.customRules = options.customRules;

    const allAgents: BaseAgent[] = [
      new SecuritySentinelAgent(),
      new LogicHoundAgent(),
      new PerformanceCriticAgent(),
      ...(options.customAgents || []),
    ];

    if (options.enabledAgents && options.enabledAgents.length > 0) {
      const selected = new Set(options.enabledAgents.map((a) => a.toLowerCase().trim()));
      this.agents = allAgents.filter((agent) =>
        selected.has(agent.agentType) ||
        selected.has(agent.displayName.toLowerCase()) ||
        selected.has(agent.agentType.replace('-sentinel', '').replace('-hound', '').replace('-critic', ''))
      );
    } else {
      this.agents = allAgents;
    }

    if (this.agents.length === 0) {
      this.agents = allAgents;
    }
  }

  getActiveAgents(): BaseAgent[] {
    return this.agents;
  }

  async run(chunks: DiffChunk[]): Promise<AgentReviewResult[]> {
    if (chunks.length === 0) {
      return [];
    }

    const isCI = !!process.env.CI || !process.stdout.isTTY;
    const allResults: AgentReviewResult[] = [];

    for (const chunk of chunks) {
      const chunkPrefix = chunks.length > 1 ? `[Chunk ${chunk.chunkIndex}/${chunk.totalChunks}] ` : '';

      let spinner: Ora | null = null;
      if (!isCI) {
        spinner = ora({
          text: `${chunkPrefix}Running ${this.agents.length} review agents in parallel on ${chunk.fileCount} files...`,
          color: 'cyan',
        }).start();
      } else {
        console.log(`${chunkPrefix}Running ${this.agents.map((a) => a.displayName).join(', ')}...`);
      }

      // Execute all agents on this chunk concurrently
      const agentPromises = this.agents.map(async (agent) => {
        try {
          const res = await agent.review(
            chunk,
            this.provider,
            this.model,
            this.customPrompt,
            this.customRules
          );
          return { success: true as const, res, agent };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false as const, error: msg, agent };
        }
      });

      const settled = await Promise.all(agentPromises);

      if (spinner) {
        spinner.succeed(`${chunkPrefix}Multi-agent analysis completed.`);
      }

      for (const item of settled) {
        if (item.success) {
          allResults.push(item.res);
          if (this.verbose) {
            console.log(chalk.gray(`  ✓ ${item.agent.displayName}: found ${item.res.findings.length} points`));
          }
        } else {
          console.warn(chalk.yellow(`  ⚠ ${item.agent.displayName} failed on chunk ${chunk.chunkIndex}: ${item.error}`));
        }
      }
    }

    return allResults;
  }
}
