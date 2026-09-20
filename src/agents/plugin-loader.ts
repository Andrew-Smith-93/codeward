import fs from 'node:fs/promises';
import path from 'node:path';
import { BaseAgent } from './base-agent.js';
import { AgentType } from '../types/index.js';
import { CodewardConfig } from '../config/loader.js';

export interface CustomAgentConfig {
  agentType: string;
  displayName: string;
  description: string;
  systemPrompt: string;
}

export class ConfigurableCustomAgent extends BaseAgent {
  public readonly agentType: AgentType;
  public readonly displayName: string;
  public readonly description: string;
  private customSystemPrompt: string;

  constructor(cfg: CustomAgentConfig) {
    super();
    this.agentType = cfg.agentType as AgentType;
    this.displayName = cfg.displayName;
    this.description = cfg.description;
    this.customSystemPrompt = cfg.systemPrompt;
  }

  getSystemPrompt(): string {
    return this.customSystemPrompt;
  }
}

export async function loadCustomAgents(
  config: CodewardConfig & { customAgents?: CustomAgentConfig[] },
  agentsDir?: string
): Promise<BaseAgent[]> {
  const loaded: BaseAgent[] = [];

  // 1. From config JSON
  if (config.customAgents && Array.isArray(config.customAgents)) {
    for (const agentCfg of config.customAgents) {
      if (agentCfg.agentType && agentCfg.systemPrompt) {
        loaded.push(new ConfigurableCustomAgent(agentCfg));
      }
    }
  }

  // 2. From .codeward/agents/*.json
  const targetDir = agentsDir || path.resolve(process.cwd(), '.codeward', 'agents');
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const raw = await fs.readFile(path.join(targetDir, entry.name), 'utf-8');
          const parsed = JSON.parse(raw) as CustomAgentConfig;
          if (parsed.agentType && parsed.systemPrompt) {
            loaded.push(new ConfigurableCustomAgent(parsed));
          }
        } catch {
          // Skip invalid agent config file
        }
      }
    }
  } catch {
    // Directory does not exist, ignore
  }

  return loaded;
}
