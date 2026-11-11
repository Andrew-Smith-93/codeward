import assert from 'node:assert/strict';
import { it } from 'node:test';
import { emitGitHubAnnotations } from '../../src/reporters/github-annotations.js';
import type { AggregatedReport } from '../../src/types/index.js';

it('never emits mock findings as GitHub annotations but retains real-provider output', () => {
  const oldEnv = process.env.GITHUB_ACTIONS;
  const oldLog = console.log;
  const lines: string[] = [];
  process.env.GITHUB_ACTIONS = 'true';
  console.log = (line: string) => { lines.push(line); };
  try {
    const report = { provider: 'mock', findings: [{ severity: 'CRITICAL', file: 'a.ts', line: 1,
      rule: 'TEST', title: 'Canned fixture', description: 'Synthetic data' }] } as AggregatedReport;
    emitGitHubAnnotations(report);
    assert.equal(lines.length, 0);
    emitGitHubAnnotations({ ...report, provider: 'openai' });
    assert.equal(lines.length, 1);
    assert.ok(lines[0].startsWith('::error '));
  } finally {
    console.log = oldLog;
    if (oldEnv === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = oldEnv;
  }
});
