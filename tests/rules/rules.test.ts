import { describe, it, expect } from 'vitest';
import { lookupRule, RULE_REGISTRY } from '../../src/rules/index.js';

describe('Rules Registry', () => {
  it('contains expected security, logic, and performance rules', () => {
    expect(RULE_REGISTRY['SEC-001']).toBeDefined();
    expect(RULE_REGISTRY['SEC-001'].cwe).toBe('CWE-798');
    expect(RULE_REGISTRY['SEC-002'].owasp).toContain('A03:2021');

    expect(RULE_REGISTRY['LOGIC-001']).toBeDefined();
    expect(RULE_REGISTRY['LOGIC-001'].defaultSeverity).toBe('WARNING');

    expect(RULE_REGISTRY['PERF-001']).toBeDefined();
    expect(RULE_REGISTRY['PERF-001'].name).toContain('N+1');
  });

  it('looks up rule by exact ID or fuzzy title', () => {
    const byId = lookupRule('SEC-002');
    expect(byId).toBeDefined();
    expect(byId?.id).toBe('SEC-002');

    const byFuzzy = lookupRule('SQL / NoSQL Injection');
    expect(byFuzzy).toBeDefined();
    expect(byFuzzy?.id).toBe('SEC-002');
  });
});
