import { describe, it, expect } from 'vitest';
import { renderSarifReport } from '../../src/reporters/sarif-reporter.js';
import { AggregatedReport } from '../../src/types/index.js';

describe('SARIF Reporter', () => {
  it('generates compliant SARIF 2.1.0 output', () => {
    const report: AggregatedReport = {
      findings: [
        {
          id: 'sec-1',
          agent: 'security-sentinel',
          rule: 'SEC-001',
          severity: 'CRITICAL',
          file: 'src/auth/jwt.ts',
          line: 18,
          endLine: 18,
          title: 'Hardcoded secret token',
          description: 'Hardcoded secret key used to sign tokens.',
          codeSnippet: 'const key = "supersecret";',
          suggestedFix: 'const key = process.env.JWT_SECRET;',
          confidence: 0.99,
        },
      ],
      summary: '1 critical security vulnerability found',
      stats: {
        critical: 1,
        warning: 0,
        suggestion: 0,
        total: 1,
        filesReviewed: 1,
        agentsRan: 3,
      },
      verdict: 'FAIL',
      durationMs: 800,
      provider: 'openai',
      model: 'gpt-4o',
      gitRef: 'main...HEAD',
      timestamp: '2026-09-20T06:00:00.000Z',
    };

    const sarifJson = renderSarifReport(report);
    const parsed = JSON.parse(sarifJson);

    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs).toHaveLength(1);

    const run = parsed.runs[0];
    expect(run.tool.driver.name).toBe('Codeward');
    expect(run.results).toHaveLength(1);

    const result = run.results[0];
    expect(result.ruleId).toBe('SEC-001');
    expect(result.level).toBe('error');
    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe('src/auth/jwt.ts');
    expect(result.locations[0].physicalLocation.region.startLine).toBe(18);
  });
});
