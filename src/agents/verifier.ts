import { Finding } from '../types/index.js';
import { LLMProvider } from '../providers/types.js';

const TEST_PATH_PATTERNS = [
  /tests?\//i,
  /__tests__\//i,
  /fixtures?\//i,
  /mocks?\//i,
  /\.test\.[jt]sx?$/i,
  /\.spec\.[jt]sx?$/i,
];

const MOCK_SECRET_PATTERNS = [
  /example/i,
  /dummy/i,
  /test/i,
  /mock/i,
  /placeholder/i,
  /sample/i,
  /fake/i,
  /xxx/i,
  /123456/,
  /your[-_]api[-_]key/i,
];

/**
 * Verifies findings to weed out test fixtures and obvious false alarms.
 */
export function sanitizeAndFilterFindings(findings: Finding[]): Finding[] {
  return findings.map((f) => {
    const isTestFile = TEST_PATH_PATTERNS.some((p) => p.test(f.file));

    // If it's a test file and flagged as CRITICAL for secrets/injection:
    if (isTestFile && f.severity === 'CRITICAL') {
      const isMockSecret = f.codeSnippet && MOCK_SECRET_PATTERNS.some((p) => p.test(f.codeSnippet!));
      if (isMockSecret || f.rule.includes('SECRET')) {
        return {
          ...f,
          severity: 'SUGGESTION',
          title: `[Test Fixture] ${f.title}`,
          description: `${f.description} (Note: Detected in test or mock file; downgraded to suggestion to avoid blocking CI).`,
          confidence: Math.min(f.confidence || 0.9, 0.6),
        };
      }
    }

    return f;
  });
}

/**
 * Performs an LLM-based second-opinion verification pass on critical findings.
 */
export async function verifyCriticalFindings(
  findings: Finding[],
  provider: LLMProvider,
  model?: string
): Promise<Finding[]> {
  const criticals = findings.filter((f) => f.severity === 'CRITICAL');
  if (criticals.length === 0) {
    return findings;
  }

  const prompt = `You are a Principal Security Architect performing a verification review on the following critical code review findings.
Determine if each finding is a REAL vulnerability or a FALSE POSITIVE (e.g. test code, dummy mockup, unreachable path, false assumption).

Findings to verify:
${JSON.stringify(criticals, null, 2)}

Respond with JSON:
{
  "verifiedFindings": [
    {
      "id": "finding-id",
      "isReal": true | false,
      "adjustedSeverity": "CRITICAL" | "WARNING" | "SUGGESTION",
      "reason": "why it is real or false alarm"
    }
  ]
}`;

  try {
    const res = await provider.generate({
      systemPrompt: 'You are an elite security auditor evaluating false positives in automated code reviews. Respond with JSON only.',
      userPrompt: prompt,
      model,
      temperature: 0.0,
      responseFormat: 'json',
    });

    if (res.parsedJson && typeof res.parsedJson === 'object') {
      const data = res.parsedJson as { verifiedFindings?: Array<{ id: string; isReal: boolean; adjustedSeverity?: string; reason?: string }> };
      if (Array.isArray(data.verifiedFindings)) {
        const verdicts = new Map(data.verifiedFindings.map((v) => [v.id, v]));

        return findings.map((f) => {
          const v = verdicts.get(f.id || '');
          if (!v) return f;

          if (!v.isReal) {
            return {
              ...f,
              severity: 'SUGGESTION',
              title: `[False Alarm] ${f.title}`,
              description: `${f.description}\n(Verifier note: ${v.reason || 'Downgraded after second-pass audit'})`,
              confidence: 0.5,
            };
          }

          return f;
        });
      }
    }
  } catch {
    // If verifier fails, retain original findings
  }

  return findings;
}
