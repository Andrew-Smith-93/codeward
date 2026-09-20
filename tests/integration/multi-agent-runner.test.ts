import { describe, it, expect } from 'vitest';
import { MultiAgentRunner } from '../../src/agents/runner.js';
import { MockProvider } from '../../src/providers/mock.js';
import { DiffChunk } from '../../src/git/chunker.js';
import { synthesizeReport } from '../../src/synthesizer/aggregator.js';

describe('MultiAgentRunner with MockProvider', () => {
  it('runs all three agents concurrently and aggregates results', async () => {
    const mockProvider = new MockProvider();
    const runner = new MultiAgentRunner({
      provider: mockProvider,
      verbose: false,
    });

    const mockChunk: DiffChunk = {
      chunkIndex: 1,
      totalChunks: 1,
      fileCount: 1,
      diffText: 'diff --git a/src/app.ts b/src/app.ts\n+const token = "sk_live_123";',
      files: [
        {
          oldPath: 'src/app.ts',
          newPath: 'src/app.ts',
          isNew: false,
          isDeleted: false,
          isRenamed: false,
          hunks: [],
          rawDiff: '+const token = "sk_live_123";',
        },
      ],
    };

    const agentResults = await runner.run([mockChunk]);
    expect(agentResults).toHaveLength(3); // Security Sentinel, Logic Hound, Performance Critic

    const report = synthesizeReport(agentResults, {
      providerName: mockProvider.name,
      modelName: mockProvider.defaultModel,
      gitRef: 'staged',
      filesReviewedCount: 1,
      durationMs: 350,
    });

    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.stats.critical).toBeGreaterThanOrEqual(1);
    expect(report.verdict).toBe('FAIL');
  });

  it('filters active agents based on options', () => {
    const runner = new MultiAgentRunner({
      provider: new MockProvider(),
      enabledAgents: ['security'],
    });

    const active = runner.getActiveAgents();
    expect(active).toHaveLength(1);
    expect(active[0].agentType).toBe('security-sentinel');
  });
});
