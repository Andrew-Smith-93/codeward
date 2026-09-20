import { CompletionRequest, CompletionResponse, LLMProvider } from './types.js';

export interface MockProviderConfig {
  cannedFindings?: Array<Record<string, unknown>>;
  cannedSummary?: string;
}

export class MockProvider implements LLMProvider {
  public readonly name = 'mock';
  public readonly defaultModel = 'mock-llm-v1';

  constructor(private config: MockProviderConfig = {}) {}

  async generate(request: CompletionRequest): Promise<CompletionResponse> {
    const isSecurity = request.systemPrompt.includes('Security Sentinel');
    const isLogic = request.systemPrompt.includes('Logic & Reliability Hound');

    let findings: Array<Record<string, unknown>> = [];
    let summary = 'Review completed with mock analyzer.';

    if (this.config.cannedFindings) {
      findings = this.config.cannedFindings;
      summary = this.config.cannedSummary || summary;
    } else if (isSecurity) {
      findings = [
        {
          rule: 'SEC-001-SECRET-LEAK',
          severity: 'CRITICAL',
          file: 'src/config/auth.ts',
          line: 12,
          endLine: 12,
          title: 'Hardcoded API secret token found in source code',
          description: 'A hardcoded plaintext API token or private key was detected. Secrets must be stored in secure environment variables or a secrets manager.',
          codeSnippet: 'const API_SECRET = "sk_live_99238472938472938472";',
          suggestedFix: 'const API_SECRET = process.env.API_SECRET;',
          confidence: 0.98,
        },
      ];
      summary = 'Security Sentinel detected 1 critical secret leak.';
    } else if (isLogic) {
      findings = [
        {
          rule: 'LOGIC-003-UNHANDLED-PROMISE',
          severity: 'WARNING',
          file: 'src/services/user.ts',
          line: 45,
          endLine: 48,
          title: 'Uncaught asynchronous promise rejection',
          description: 'The async call to syncUserData() is missing a catch handler or try/await, which may cause an unhandled promise rejection in production.',
          codeSnippet: 'syncUserData(user.id);',
          suggestedFix: 'await syncUserData(user.id).catch(err => logger.error("Sync failed", err));',
          confidence: 0.89,
        },
      ];
      summary = 'Logic Hound detected 1 unhandled promise edge case.';
    } else {
      findings = [
        {
          rule: 'PERF-002-N-PLUS-ONE',
          severity: 'SUGGESTION',
          file: 'src/db/queries.ts',
          line: 88,
          endLine: 92,
          title: 'Potential N+1 database query in loop',
          description: 'Query executed inside for...of loop. Consider batching queries with an `IN (...)` clause or dataloader.',
          codeSnippet: 'for (const item of items) { await db.fetchDetails(item.id); }',
          suggestedFix: 'const details = await db.fetchBatchDetails(items.map(i => i.id));',
          confidence: 0.85,
        },
      ];
      summary = 'Performance Critic detected 1 query batching suggestion.';
    }

    const payload = {
      findings,
      summary,
    };

    return {
      content: JSON.stringify(payload),
      parsedJson: payload,
      model: this.defaultModel,
      tokens: {
        prompt: 150,
        completion: 80,
        total: 230,
      },
    };
  }
}
