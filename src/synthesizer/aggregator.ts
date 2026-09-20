import {
  AgentReviewResult,
  AggregatedReport,
  Finding,
  ReviewStats,
  ReviewVerdict,
  Severity,
} from '../types/index.js';

export interface AggregatorOptions {
  providerName: string;
  modelName: string;
  gitRef: string;
  filesReviewedCount: number;
  durationMs: number;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  SUGGESTION: 1,
};

/**
 * Calculates string similarity using Levenshtein-like token overlap or simple Jaccard index.
 */
function tokenSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

/**
 * Checks if two findings represent the same underlying issue.
 */
export function areFindingsDuplicate(a: Finding, b: Finding): boolean {
  if (a.file !== b.file) {
    return false;
  }

  // Same line or very close lines (within 2 lines)
  const lineDistance = Math.abs(a.line - b.line);
  if (lineDistance > 2) {
    return false;
  }

  // Check title or description semantic similarity
  const titleSim = tokenSimilarity(a.title, b.title);
  const descSim = tokenSimilarity(a.description, b.description);

  if (titleSim > 0.4 || descSim > 0.4) {
    return true;
  }

  // If on the EXACT same line with matching code snippet
  if (a.line === b.line && a.codeSnippet && b.codeSnippet && a.codeSnippet.trim() === b.codeSnippet.trim()) {
    return true;
  }

  return false;
}

/**
 * Merges two duplicate findings, favoring the higher severity and most detailed remediation.
 */
export function mergeDuplicates(primary: Finding, secondary: Finding): Finding {
  const higherSeverity = SEVERITY_WEIGHT[primary.severity] >= SEVERITY_WEIGHT[secondary.severity]
    ? primary.severity
    : secondary.severity;

  const bestSuggestedFix = (primary.suggestedFix && primary.suggestedFix.length > 20)
    ? primary.suggestedFix
    : secondary.suggestedFix || primary.suggestedFix;

  const bestSnippet = primary.codeSnippet || secondary.codeSnippet;

  const combinedDescription = primary.description.length >= secondary.description.length
    ? primary.description
    : secondary.description;

  return {
    ...primary,
    severity: higherSeverity,
    description: combinedDescription,
    codeSnippet: bestSnippet,
    suggestedFix: bestSuggestedFix,
    confidence: Math.max(primary.confidence || 0.9, secondary.confidence || 0.9),
  };
}

/**
 * Aggregates, deduplicates, and ranks findings across all agent results.
 */
export function synthesizeReport(
  agentResults: AgentReviewResult[],
  options: AggregatorOptions
): AggregatedReport {
  const rawFindings: Finding[] = [];
  const agentSummaries: string[] = [];
  const uniqueAgents = new Set<string>();

  for (const res of agentResults) {
    uniqueAgents.add(res.agent);
    if (res.summary) {
      agentSummaries.push(`[${res.agent}]: ${res.summary}`);
    }
    for (const f of res.findings) {
      rawFindings.push({
        ...f,
        agent: f.agent || res.agent,
      });
    }
  }

  // Deduplicate
  const deduplicated: Finding[] = [];

  for (const candidate of rawFindings) {
    const existingIndex = deduplicated.findIndex((existing) => areFindingsDuplicate(existing, candidate));

    if (existingIndex !== -1) {
      deduplicated[existingIndex] = mergeDuplicates(deduplicated[existingIndex], candidate);
    } else {
      deduplicated.push({ ...candidate });
    }
  }

  // Sort by severity (CRITICAL > WARNING > SUGGESTION), then confidence (desc), then file, then line
  deduplicated.sort((a, b) => {
    const diffSev = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (diffSev !== 0) return diffSev;

    const confA = a.confidence || 0.9;
    const confB = b.confidence || 0.9;
    if (confB !== confA) return confB - confA;

    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  const stats: ReviewStats = {
    critical: deduplicated.filter((f) => f.severity === 'CRITICAL').length,
    warning: deduplicated.filter((f) => f.severity === 'WARNING').length,
    suggestion: deduplicated.filter((f) => f.severity === 'SUGGESTION').length,
    total: deduplicated.length,
    filesReviewed: options.filesReviewedCount,
    agentsRan: uniqueAgents.size,
  };

  let verdict: ReviewVerdict = 'PASS';
  if (stats.critical > 0) {
    verdict = 'FAIL';
  } else if (stats.warning > 0) {
    verdict = 'WARN';
  }

  const executiveSummary = stats.total === 0
    ? 'All agents passed inspection with zero security, reliability, or architectural concerns detected.'
    : `Identified ${stats.total} total issue${stats.total === 1 ? '' : 's'} across ${stats.filesReviewed} file${stats.filesReviewed === 1 ? '' : 's'}: ` +
      `${stats.critical} Critical, ${stats.warning} Warnings, ${stats.suggestion} Suggestions.`;

  return {
    findings: deduplicated,
    summary: executiveSummary,
    stats,
    verdict,
    durationMs: options.durationMs,
    provider: options.providerName,
    model: options.modelName,
    gitRef: options.gitRef,
    timestamp: new Date().toISOString(),
  };
}
