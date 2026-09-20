import { describe, it, expect } from 'vitest';
import { extractAndParseJSON } from '../../src/providers/json-parser.js';

describe('JSON Parser', () => {
  it('parses pure JSON string', () => {
    const raw = '{"findings": [], "summary": "Looks clean"}';
    const result = extractAndParseJSON<{ findings: unknown[]; summary: string }>(raw);
    expect(result.summary).toBe('Looks clean');
    expect(result.findings).toEqual([]);
  });

  it('extracts JSON wrapped in markdown code fence', () => {
    const raw = `Here is my analysis:
\`\`\`json
{
  "findings": [
    { "title": "SQL Injection", "line": 20 }
  ],
  "summary": "1 bug found"
}
\`\`\`
Hope this helps!`;

    const result = extractAndParseJSON<{ findings: Array<{ title: string; line: number }>; summary: string }>(raw);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toBe('SQL Injection');
    expect(result.summary).toBe('1 bug found');
  });

  it('extracts JSON surrounded by raw text without fences', () => {
    const raw = `I examined the diff carefully:
{"findings": [], "summary": "No issues"}
Please review again.`;

    const result = extractAndParseJSON<{ findings: unknown[]; summary: string }>(raw);
    expect(result.summary).toBe('No issues');
  });

  it('throws helpful error when no JSON structure is present', () => {
    expect(() => extractAndParseJSON('Just plain text without braces')).toThrow(
      /No valid JSON structure found/
    );
  });
});
