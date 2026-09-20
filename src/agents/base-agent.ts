import { AgentReviewResult, AgentReviewResultSchema, AgentType, Finding } from '../types/index.js';
import { LLMProvider } from '../providers/types.js';
import { DiffChunk } from '../git/chunker.js';

export abstract class BaseAgent {
  abstract readonly agentType: AgentType;
  abstract readonly displayName: string;
  abstract readonly description: string;

  abstract getSystemPrompt(): string;

  getUserPrompt(chunk: DiffChunk): string {
    const fileList = chunk.files.map((f) => `- ${f.newPath !== 'unknown' ? f.newPath : f.oldPath}`).join('\n');

    return `Review the following git diff chunk (${chunk.chunkIndex} of ${chunk.totalChunks}).

Files included in this chunk:
${fileList}

Unified Git Diff:
\`\`\`diff
${chunk.diffText}
\`\`\`

Analyze ONLY the additions and modifications in the diff above according to your specialized persona.
Respond with a strict JSON object with this exact schema:
{
  "findings": [
    {
      "rule": "RULE-ID-OR-NAME",
      "severity": "CRITICAL" | "WARNING" | "SUGGESTION",
      "file": "path/to/file.ext",
      "line": 12,
      "endLine": 14,
      "title": "Concise issue summary under 80 chars",
      "description": "Clear technical explanation of what is wrong and why",
      "codeSnippet": "problematic line(s)",
      "suggestedFix": "corrected code snippet or exact remediation",
      "confidence": 0.95
    }
  ],
  "summary": "High-level summary of your findings from your specialized lens."
}

Rules:
1. Report ONLY issues introduced or worsened by the changes in the diff.
2. The "file" MUST match one of the files in the diff.
3. The "line" MUST correspond to an added line (+) or direct context line in the new file.
4. "severity" MUST be one of: "CRITICAL", "WARNING", "SUGGESTION".
5. If there are NO issues meeting your criteria, return "findings": [] and an encouraging summary.
6. Zero fluff. No conversational greetings or preambles. Output JSON only.`;
  }

  async review(chunk: DiffChunk, provider: LLMProvider, model?: string): Promise<AgentReviewResult> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(chunk);

    const response = await provider.generate({
      systemPrompt,
      userPrompt,
      model,
      temperature: 0.1,
      responseFormat: 'json',
    });

    let findings: Finding[] = [];
    let summary = 'Review completed.';

    if (response.parsedJson && typeof response.parsedJson === 'object') {
      const data = response.parsedJson as Record<string, unknown>;
      summary = typeof data.summary === 'string' ? data.summary : summary;

      if (Array.isArray(data.findings)) {
        for (const item of data.findings) {
          try {
            const parsed = FindingSchemaPartial(item, this.agentType);
            if (parsed) {
              findings.push(parsed);
            }
          } catch {
            // Skip malformed individual finding
          }
        }
      }
    }

    return {
      agent: this.agentType,
      findings,
      summary,
      tokensUsed: response.tokens,
    };
  }
}

function FindingSchemaPartial(raw: unknown, agentType: AgentType): Finding | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  const severityRaw = String(item.severity || 'WARNING').toUpperCase();
  const severity = severityRaw === 'CRITICAL' ? 'CRITICAL' : severityRaw === 'SUGGESTION' ? 'SUGGESTION' : 'WARNING';

  const file = String(item.file || 'unknown');
  const line = Math.max(1, parseInt(String(item.line || 1), 10) || 1);
  const endLine = item.endLine ? Math.max(line, parseInt(String(item.endLine), 10) || line) : undefined;
  const title = String(item.title || 'Code issue identified').slice(0, 120);
  const description = String(item.description || title);
  const rule = String(item.rule || `${agentType.toUpperCase()}-RULE`);
  const codeSnippet = item.codeSnippet ? String(item.codeSnippet) : undefined;
  const suggestedFix = item.suggestedFix ? String(item.suggestedFix) : undefined;
  const confidence = typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0.9;

  return {
    id: `${agentType}-${file}-${line}-${Math.random().toString(36).substring(2, 7)}`,
    agent: agentType,
    rule,
    severity,
    file,
    line,
    endLine,
    title,
    description,
    codeSnippet,
    suggestedFix,
    confidence,
  };
}
