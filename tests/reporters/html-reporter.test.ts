import { describe, it, expect } from 'vitest';
import { renderHtmlReport } from '../../src/reporters/html-reporter.js';
import { AggregatedReport } from '../../src/types/index.js';

describe('HTML Reporter', () => {
  it('generates valid self-contained HTML document with interactive components', () => {
    const report: AggregatedReport = {
      findings: [
        {
          id: 'test-1',
          rule: 'SEC-001',
          severity: 'CRITICAL',
          file: 'src/main.ts',
          line: 10,
          title: 'Critical Vulnerability',
          description: 'Security risk',
          suggestedFix: 'const safe = 1;',
          codeSnippet: 'const unsafe = 1;',
        },
      ],
      summary: '1 critical issue found',
      stats: {
        critical: 1,
        warning: 0,
        suggestion: 0,
        total: 1,
        filesReviewed: 1,
        agentsRan: 3,
      },
      verdict: 'FAIL',
      durationMs: 900,
      provider: 'openai',
      model: 'gpt-4o',
      gitRef: 'main...HEAD',
      timestamp: '2026-09-20T06:00:00.000Z',
    };

    const html = renderHtmlReport(report);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('CODEWARD');
    expect(html).toContain('Critical Vulnerability');
    expect(html).toContain('src/main.ts');
    expect(html).toContain('"line":10');
    expect(html).toContain('const safe = 1;');
    expect(html).toContain('setFilter');
    expect(html).toContain('applySearch');
  });
});
