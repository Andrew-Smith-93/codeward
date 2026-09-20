import { describe, it, expect } from 'vitest';
import { renderTerminalReport } from '../../src/reporters/terminal-reporter.js';
import { renderMarkdownReport } from '../../src/reporters/markdown-reporter.js';
import { renderJsonReport } from '../../src/reporters/json-reporter.js';
import { AggregatedReport } from '../../src/types/index.js';

describe('Reporters', () => {
  const sampleReport: AggregatedReport = {
    findings: [
      {
        id: 'f1',
        agent: 'security-sentinel',
        rule: 'SEC-001',
        severity: 'CRITICAL',
        file: 'src/auth.ts',
        line: 12,
        title: 'Hardcoded secret token',
        description: 'Secret token stored directly in source code.',
        codeSnippet: 'const token = "secret123";',
        suggestedFix: 'const token = process.env.API_KEY;',
        confidence: 0.99,
      },
    ],
    summary: 'Found 1 critical issue in 1 file.',
    stats: {
      critical: 1,
      warning: 0,
      suggestion: 0,
      total: 1,
      filesReviewed: 1,
      agentsRan: 3,
    },
    verdict: 'FAIL',
    durationMs: 1500,
    provider: 'openai',
    model: 'gpt-4o-mini',
    gitRef: 'main...HEAD',
    timestamp: '2026-09-20T06:00:00.000Z',
  };

  it('renders Terminal output with badges and boxes', () => {
    const output = renderTerminalReport(sampleReport);
    expect(output).toContain('CODEWARD');
    expect(output).toContain('FAIL');
    expect(output).toContain('src/auth.ts:12');
    expect(output).toContain('Hardcoded secret token');
  });

  it('renders Markdown PR report with tables, collapsible tags, and suggestion blocks', () => {
    const md = renderMarkdownReport(sampleReport);
    expect(md).toContain('## 🚨 Codeward Code Review & Security Audit');
    expect(md).toContain('| Target Diff | Engine | Files Audited |');
    expect(md).toContain('<details open>');
    expect(md).toContain('```suggestion');
    expect(md).toContain('const token = process.env.API_KEY;');
  });

  it('renders JSON report with valid schema', () => {
    const jsonStr = renderJsonReport(sampleReport);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.verdict).toBe('FAIL');
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.stats.critical).toBe(1);
  });
});
