import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { applyFixes } from '../../src/fixer/patcher.js';
import { Finding } from '../../src/types/index.js';

describe('Auto-Fix Patcher', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeward-patcher-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('successfully patches a single-line issue with suggestedFix', async () => {
    const filePath = path.join(tmpDir, 'auth.ts');
    const originalContent = [
      'export function getApiKey() {',
      '  const key = "sk_live_123456";',
      '  return key;',
      '}',
    ].join('\n');

    await fs.writeFile(filePath, originalContent, 'utf-8');

    const finding: Finding = {
      file: 'auth.ts',
      line: 2,
      endLine: 2,
      rule: 'SEC-001',
      severity: 'CRITICAL',
      title: 'Hardcoded secret',
      description: 'Secret in code',
      suggestedFix: '  const key = process.env.API_KEY;',
    };

    const results = await applyFixes([finding], tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);

    const updated = await fs.readFile(filePath, 'utf-8');
    expect(updated).toContain('const key = process.env.API_KEY;');
    expect(updated).not.toContain('sk_live_123456');
  });

  it('applies multiple fixes in the same file from bottom to top', async () => {
    const filePath = path.join(tmpDir, 'service.ts');
    const originalContent = [
      '// line 1',
      'const x = eval("foo");', // line 2
      '// line 3',
      '// line 4',
      'db.query("SELECT * " + input);', // line 5
    ].join('\n');

    await fs.writeFile(filePath, originalContent, 'utf-8');

    const findings: Finding[] = [
      {
        file: 'service.ts',
        line: 2,
        endLine: 2,
        rule: 'SEC-003',
        severity: 'CRITICAL',
        title: 'eval injection',
        description: 'eval',
        suggestedFix: 'const x = JSON.parse("foo");',
      },
      {
        file: 'service.ts',
        line: 5,
        endLine: 5,
        rule: 'SEC-002',
        severity: 'CRITICAL',
        title: 'SQL injection',
        description: 'sql',
        suggestedFix: 'db.query("SELECT * WHERE x = ?", [input]);',
      },
    ];

    const results = await applyFixes(findings, tmpDir);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);

    const updated = await fs.readFile(filePath, 'utf-8');
    expect(updated).toContain('JSON.parse("foo");');
    expect(updated).toContain('db.query("SELECT * WHERE x = ?", [input]);');
  });
});
