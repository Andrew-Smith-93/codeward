import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FindingSchema, AgentReviewResultSchema } from '../../src/types/index.js';
import { CodewardConfigSchema } from '../../src/config/loader.js';

describe('public schema compatibility', () => {
  const finding = { rule: 'SEC-001', severity: 'WARNING', file: 'app.ts', line: 1,
    title: 'Example', description: 'A valid fixture finding' };
  it('retains config defaults and strips unknown keys', () => {
    assert.deepEqual(CodewardConfigSchema.parse({ ignored: true }), {
      failOn: 'critical', concurrency: 4, maxCritical: 0, maxWarning: 100,
    });
    assert.equal(CodewardConfigSchema.parse({ customRules: [{ id: 'one', name: 'One', description: 'Fixture' }] }).customRules?.[0].severity, 'WARNING');
  });
  it('retains finding defaults and rejects invalid locations and confidence', () => {
    assert.equal(FindingSchema.parse(finding).confidence, 1);
    for (const extra of [{ line: 0 }, { line: 1.5 }, { confidence: -1 }, { confidence: 2 }, { severity: 'UNKNOWN' }]) {
      assert.equal(FindingSchema.safeParse({ ...finding, ...extra }).success, false);
    }
  });
  it('validates nested review results and rejects invalid config bounds', () => {
    assert.equal(AgentReviewResultSchema.parse({ agent: 'security-sentinel', findings: [finding], summary: 'Fixture' }).findings.length, 1);
    assert.equal(CodewardConfigSchema.safeParse({ concurrency: 0 }).success, false);
    assert.equal(CodewardConfigSchema.safeParse({ provider: 'unknown' }).success, false);
  });
});
