import { describe, it, expect } from 'vitest';
import { loadCustomAgents } from '../../src/agents/plugin-loader.js';

describe('Plugin Loader', () => {
  it('instantiates custom agents from configuration', async () => {
    const customConfig = {
      failOn: 'critical' as const,
      concurrency: 4,
      maxCritical: 0,
      maxWarning: 100,
      customAgents: [
        {
          agentType: 'hipaa-sentinel',
          displayName: 'HIPAA & PII Sentinel',
          description: 'Audits patient data handling',
          systemPrompt: 'You audit healthcare data for HIPAA compliance.',
        },
      ],
    };

    const agents = await loadCustomAgents(customConfig);
    expect(agents).toHaveLength(1);
    expect(agents[0].displayName).toBe('HIPAA & PII Sentinel');
    expect(agents[0].getSystemPrompt()).toContain('HIPAA compliance');
  });
});
