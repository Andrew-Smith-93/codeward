import { GitExtractor } from './git/diff-extractor.js';
import { chunkDiffFiles } from './git/chunker.js';
import { parseDiff, extractSnippetAroundLine } from './git/diff-parser.js';
import { shouldIgnoreFile } from './git/filter.js';
import { resolveProvider } from './providers/factory.js';
import { MultiAgentRunner } from './agents/runner.js';
import { loadCustomAgents } from './agents/plugin-loader.js';
import { sanitizeAndFilterFindings, verifyCriticalFindings } from './agents/verifier.js';
import { synthesizeReport } from './synthesizer/aggregator.js';
import { renderTerminalReport } from './reporters/terminal-reporter.js';
import { renderMarkdownReport } from './reporters/markdown-reporter.js';
import { renderJsonReport } from './reporters/json-reporter.js';
import { renderSarifReport } from './reporters/sarif-reporter.js';
import { renderHtmlReport } from './reporters/html-reporter.js';
import { emitGitHubAnnotations } from './reporters/github-annotations.js';
import { loadConfig, CodewardConfig } from './config/loader.js';
import { applyFixes, FixResult } from './fixer/patcher.js';
import { promptAndApplyFixes } from './fixer/interactive.js';
import { submitGitHubPRReview } from './github/pr-reviewer.js';
import { AggregatedReport, ReviewOptions, Finding } from './types/index.js';

/**
 * Programmatic API: Run full multi-agent review on git changes.
 * Ideal for agent swarms, CI pipelines, and custom developer tooling.
 */
export async function review(
  options: ReviewOptions = {},
  customConfig?: CodewardConfig
): Promise<AggregatedReport> {
  const startTime = Date.now();
  const config = customConfig || (await loadConfig());

  const git = new GitExtractor();
  const { files, gitRef } = await git.extractReviewableDiff(options);

  if (files.length === 0) {
    return {
      findings: [],
      summary: 'No reviewable diff changes detected.',
      stats: {
        critical: 0,
        warning: 0,
        suggestion: 0,
        total: 0,
        filesReviewed: 0,
        agentsRan: 0,
      },
      verdict: 'PASS',
      durationMs: Date.now() - startTime,
      provider: options.provider || config.provider || 'mock',
      model: options.model || config.model || 'default',
      gitRef,
      timestamp: new Date().toISOString(),
    };
  }

  const chunks = chunkDiffFiles(files);
  const provider = resolveProvider(options);
  const effectiveModel = options.model || config.model || provider.defaultModel;

  const customAgents = await loadCustomAgents(config);

  const runner = new MultiAgentRunner({
    provider,
    model: effectiveModel,
    enabledAgents: options.agents || config.agents,
    verbose: options.verbose,
    customPrompt: config.customPrompt,
    customRules: config.customRules,
    customAgents,
  });

  const agentResults = await runner.run(chunks);
  const durationMs = Date.now() - startTime;

  const report = synthesizeReport(agentResults, {
    providerName: provider.name,
    modelName: effectiveModel,
    gitRef,
    filesReviewedCount: files.length,
    durationMs,
  });

  report.findings = sanitizeAndFilterFindings(report.findings);

  return report;
}

/**
 * Programmatic API: Run review and automatically apply code fixes to disk.
 */
export async function fix(
  options: ReviewOptions = {},
  autoConfirm: boolean = true
): Promise<{ report: AggregatedReport; fixResults: FixResult[] }> {
  const report = await review(options);
  const fixResults = await applyFixes(report.findings);
  return { report, fixResults };
}

// Export domain types and schemas
export * from './types/index.js';

// Export providers
export { resolveProvider } from './providers/factory.js';
export { OpenAIProvider } from './providers/openai.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { GeminiProvider } from './providers/gemini.js';
export { OllamaProvider } from './providers/ollama.js';
export { MockProvider } from './providers/mock.js';
export { extractAndParseJSON } from './providers/json-parser.js';
export type { LLMProvider, CompletionRequest, CompletionResponse } from './providers/types.js';

// Export agents
export { BaseAgent } from './agents/base-agent.js';
export { SecuritySentinelAgent } from './agents/security-sentinel.js';
export { LogicHoundAgent } from './agents/logic-hound.js';
export { PerformanceCriticAgent } from './agents/performance-critic.js';
export { MultiAgentRunner } from './agents/runner.js';
export { loadCustomAgents, ConfigurableCustomAgent } from './agents/plugin-loader.js';
export { sanitizeAndFilterFindings, verifyCriticalFindings } from './agents/verifier.js';

// Export git tools
export { GitExtractor } from './git/diff-extractor.js';
export { parseDiff, extractSnippetAroundLine } from './git/diff-parser.js';
export { chunkDiffFiles } from './git/chunker.js';
export { shouldIgnoreFile } from './git/filter.js';
export { detectGitHubContext } from './git/github-context.js';

// Export synthesizer
export { synthesizeReport, areFindingsDuplicate, mergeDuplicates } from './synthesizer/aggregator.js';

// Export reporters
export { renderTerminalReport } from './reporters/terminal-reporter.js';
export { renderMarkdownReport } from './reporters/markdown-reporter.js';
export { renderJsonReport } from './reporters/json-reporter.js';
export { renderSarifReport } from './reporters/sarif-reporter.js';
export { renderHtmlReport } from './reporters/html-reporter.js';
export { emitGitHubAnnotations } from './reporters/github-annotations.js';

// Export fixer and GitHub review integrations
export { applyFixes } from './fixer/patcher.js';
export { promptAndApplyFixes } from './fixer/interactive.js';
export { submitGitHubPRReview } from './github/pr-reviewer.js';

// Export config and rules
export { loadConfig, findConfigFile, CodewardConfigSchema } from './config/loader.js';
export { lookupRule, RULE_REGISTRY } from './rules/index.js';
