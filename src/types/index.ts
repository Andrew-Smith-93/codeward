import { z } from 'zod';

export const SeverityEnum = z.enum(['CRITICAL', 'WARNING', 'SUGGESTION']);
export type Severity = z.infer<typeof SeverityEnum>;

export const AgentTypeEnum = z.enum([
  'security-sentinel',
  'logic-hound',
  'performance-critic',
]);
export type AgentType = z.infer<typeof AgentTypeEnum>;

export const FindingSchema = z.object({
  id: z.string().optional(),
  agent: AgentTypeEnum.optional(),
  rule: z.string().describe('Short name or identifier of the triggered rule/check (e.g. SEC-001, OWASP-A03, RACE-COND)'),
  severity: SeverityEnum.describe('Impact severity: CRITICAL (breaks security/data loss), WARNING (bug risk/perf degradation), SUGGESTION (best practice/code quality)'),
  file: z.string().describe('File path relative to repository root'),
  line: z.number().int().positive().describe('Starting line number of the issue in the new code'),
  endLine: z.number().int().positive().optional().describe('Ending line number if spanning multiple lines'),
  title: z.string().describe('Concise headline explaining the issue (under 80 chars)'),
  description: z.string().describe('Clear, technical explanation of what is wrong, why it is dangerous/buggy, and how it impacts the system'),
  codeSnippet: z.string().optional().describe('Relevant code snippet showing the problem'),
  suggestedFix: z.string().optional().describe('Actionable code snippet or instructions showing how to fix it'),
  confidence: z.number().min(0).max(1).optional().default(1.0).describe('Confidence score between 0 and 1'),
});
export type Finding = z.infer<typeof FindingSchema>;

export const AgentReviewResultSchema = z.object({
  agent: AgentTypeEnum,
  findings: z.array(FindingSchema),
  summary: z.string().describe('Executive high-level summary of findings from this specific agent perspective'),
  tokensUsed: z.object({
    prompt: z.number().optional(),
    completion: z.number().optional(),
    total: z.number().optional(),
  }).optional(),
});
export type AgentReviewResult = z.infer<typeof AgentReviewResultSchema>;

export interface DiffLine {
  type: 'add' | 'del' | 'normal';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  heading: string;
  lines: DiffLine[];
  raw: string;
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  hunks: DiffHunk[];
  rawDiff: string;
}

export interface ReviewStats {
  critical: number;
  warning: number;
  suggestion: number;
  total: number;
  filesReviewed: number;
  agentsRan: number;
}

export type ReviewVerdict = 'PASS' | 'WARN' | 'FAIL';

export interface AggregatedReport {
  findings: Finding[];
  summary: string;
  stats: ReviewStats;
  verdict: ReviewVerdict;
  durationMs: number;
  provider: string;
  model: string;
  gitRef: string;
  timestamp: string;
}

export type FailOnThreshold = 'critical' | 'warning' | 'suggestion' | 'none';

export interface ReviewOptions {
  base?: string;
  staged?: boolean;
  unstaged?: boolean;
  provider?: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'mock';
  model?: string;
  apiKey?: string;
  apiUrl?: string;
  format?: 'terminal' | 'markdown' | 'json';
  output?: string;
  failOn?: FailOnThreshold;
  agents?: string[];
  concurrency?: number;
  exclude?: string[];
  verbose?: boolean;
  pr?: boolean;
}
