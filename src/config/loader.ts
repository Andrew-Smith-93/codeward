import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { SeverityEnum } from '../types/index.js';

export const CustomRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  severity: SeverityEnum.optional().default('WARNING'),
});
export type CustomRule = z.infer<typeof CustomRuleSchema>;

export const CodewardConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini', 'ollama', 'mock']).optional(),
  model: z.string().optional(),
  apiUrl: z.string().optional(),
  failOn: z.enum(['critical', 'warning', 'suggestion', 'none']).optional().default('critical'),
  agents: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  customRules: z.array(CustomRuleSchema).optional(),
  customPrompt: z.string().optional(),
  concurrency: z.number().int().positive().optional().default(4),
  maxCritical: z.number().int().min(0).optional().default(0),
  maxWarning: z.number().int().min(0).optional().default(100),
});
export type CodewardConfig = z.infer<typeof CodewardConfigSchema>;

export async function findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
  const configNames = ['.codewardrc.json', '.codewardrc', 'codeward.config.json'];

  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current) {
    for (const name of configNames) {
      const candidate = path.join(current, name);
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) {
          return candidate;
        }
      } catch {
        // File does not exist, continue
      }
    }

    if (current === root) {
      break;
    }
    current = path.dirname(current);
  }

  return null;
}

export async function loadConfig(configPath?: string): Promise<CodewardConfig> {
  const filePath = configPath || (await findConfigFile());
  if (!filePath) {
    return CodewardConfigSchema.parse({});
  }

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return CodewardConfigSchema.parse(parsed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: Could not parse config file at ${filePath}: ${msg}. Using defaults.`);
    return CodewardConfigSchema.parse({});
  }
}
