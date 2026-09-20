import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, findConfigFile } from '../../src/config/loader.js';

describe('Config Loader', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeward-cfg-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('loads and validates valid .codewardrc.json', async () => {
    const configPath = path.join(tmpDir, '.codewardrc.json');
    const sampleConfig = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      failOn: 'warning',
      agents: ['security', 'logic'],
      customRules: [
        {
          id: 'RULE-100',
          name: 'No direct console.log',
          description: 'Always use structured logger',
          severity: 'WARNING',
        },
      ],
      maxCritical: 0,
      maxWarning: 5,
    };

    await fs.writeFile(configPath, JSON.stringify(sampleConfig), 'utf-8');

    const config = await loadConfig(configPath);
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-3-5-sonnet-20241022');
    expect(config.failOn).toBe('warning');
    expect(config.agents).toEqual(['security', 'logic']);
    expect(config.customRules).toHaveLength(1);
    expect(config.customRules?.[0].id).toBe('RULE-100');
    expect(config.maxWarning).toBe(5);
  });

  it('returns default config when no file exists', async () => {
    const nonExistent = path.join(tmpDir, 'no-config.json');
    const config = await loadConfig(nonExistent);
    expect(config.failOn).toBe('critical');
    expect(config.maxCritical).toBe(0);
  });
});
