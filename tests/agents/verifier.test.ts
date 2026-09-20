import { describe, it, expect } from 'vitest';
import { sanitizeAndFilterFindings } from '../../src/agents/verifier.js';
import { Finding } from '../../src/types/index.js';

describe('False-Positive Verifier', () => {
  it('downgrades critical secret warnings in test files to suggestions', () => {
    const findings: Finding[] = [
      {
        file: 'tests/unit/auth.test.ts',
        line: 15,
        rule: 'SEC-001-SECRET',
        severity: 'CRITICAL',
        title: 'Hardcoded secret in test',
        description: 'Hardcoded secret token in code',
        codeSnippet: 'const fakeKey = "test_key_sample_123456";',
      },
      {
        file: 'src/production/auth.ts',
        line: 15,
        rule: 'SEC-001-SECRET',
        severity: 'CRITICAL',
        title: 'Hardcoded secret in prod',
        description: 'Hardcoded secret token in code',
        codeSnippet: 'const realKey = "sk_live_99238472938472938472";',
      },
    ];

    const sanitized = sanitizeAndFilterFindings(findings);
    expect(sanitized[0].severity).toBe('SUGGESTION');
    expect(sanitized[0].title).toContain('[Test Fixture]');

    // Production finding must stay CRITICAL!
    expect(sanitized[1].severity).toBe('CRITICAL');
  });
});
