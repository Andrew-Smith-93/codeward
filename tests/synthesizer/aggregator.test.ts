import { describe, it, expect } from 'vitest';
import { areFindingsDuplicate, mergeDuplicates, synthesizeReport } from '../../src/synthesizer/aggregator.js';
import { AgentReviewResult, Finding } from '../../src/types/index.js';

describe('Synthesizer & Deduplication Aggregator', () => {
  const finding1: Finding = {
    id: 'f1',
    agent: 'security-sentinel',
    rule: 'SEC-001',
    severity: 'CRITICAL',
    file: 'src/api/login.ts',
    line: 25,
    title: 'SQL injection via unescaped username query',
    description: 'Direct string concatenation in SQL statement.',
    codeSnippet: 'db.query("SELECT * FROM users WHERE name = " + user)',
    suggestedFix: 'db.query("SELECT * FROM users WHERE name = ?", [user])',
    confidence: 0.95,
  };

  const finding2: Finding = {
    id: 'f2',
    agent: 'logic-hound',
    rule: 'LOGIC-005',
    severity: 'WARNING',
    file: 'src/api/login.ts',
    line: 25,
    title: 'Unescaped username query in SQL statement',
    description: 'Potential crash or syntax failure if username contains quotes.',
    codeSnippet: 'db.query("SELECT * FROM users WHERE name = " + user)',
    suggestedFix: 'Use parameterized query with placeholders.',
    confidence: 0.85,
  };

  const finding3: Finding = {
    id: 'f3',
    agent: 'performance-critic',
    rule: 'PERF-001',
    severity: 'SUGGESTION',
    file: 'src/db/pool.ts',
    line: 10,
    title: 'Database connection pool size',
    description: 'Pool size is default. Set max connections explicitly.',
    suggestedFix: 'pool.max = 20;',
    confidence: 0.9,
  };

  it('detects duplicate findings on same file and overlapping line', () => {
    expect(areFindingsDuplicate(finding1, finding2)).toBe(true);
    expect(areFindingsDuplicate(finding1, finding3)).toBe(false);
  });

  it('merges duplicate findings favoring highest severity and best fix', () => {
    const merged = mergeDuplicates(finding1, finding2);
    expect(merged.severity).toBe('CRITICAL');
    expect(merged.suggestedFix).toBe(finding1.suggestedFix);
    expect(merged.file).toBe('src/api/login.ts');
  });

  it('synthesizes report, removes duplicates, and orders by severity', () => {
    const agentResults: AgentReviewResult[] = [
      {
        agent: 'security-sentinel',
        findings: [finding1],
        summary: 'Found 1 critical security flaw.',
      },
      {
        agent: 'logic-hound',
        findings: [finding2],
        summary: 'Found 1 unhandled string issue.',
      },
      {
        agent: 'performance-critic',
        findings: [finding3],
        summary: 'Found 1 configuration tweak.',
      },
    ];

    const report = synthesizeReport(agentResults, {
      providerName: 'openai',
      modelName: 'gpt-4o',
      gitRef: 'main...HEAD',
      filesReviewedCount: 2,
      durationMs: 1200,
    });

    // Deduplication should combine finding1 and finding2
    expect(report.findings).toHaveLength(2);
    expect(report.findings[0].severity).toBe('CRITICAL');
    expect(report.findings[1].severity).toBe('SUGGESTION');

    expect(report.stats.critical).toBe(1);
    expect(report.stats.warning).toBe(0);
    expect(report.stats.suggestion).toBe(1);
    expect(report.stats.total).toBe(2);
    expect(report.stats.filesReviewed).toBe(2);
    expect(report.stats.agentsRan).toBe(3);

    expect(report.verdict).toBe('FAIL'); // Critical causes FAIL
  });
});
