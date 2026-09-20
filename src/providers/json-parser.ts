/**
 * Extracts and parses JSON from potentially noisy LLM outputs
 * (e.g. wrapped in ```json ... ```, or with preceding/trailing commentary).
 */
export function extractAndParseJSON<T = unknown>(text: string): T {
  const clean = text.trim();

  // Try direct parse first
  try {
    return JSON.parse(clean) as T;
  } catch {
    // Continue to pattern extraction
  }

  // Look for markdown code fence ```json ... ```
  const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // Continue
    }
  }

  // Look for first '{' or '[' and last '}' or ']'
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');

  let start = -1;
  let isObject = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    start = firstBracket;
    isObject = false;
  }

  if (start !== -1) {
    const end = isObject ? clean.lastIndexOf('}') : clean.lastIndexOf(']');
    if (end > start) {
      const candidate = clean.slice(start, end + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch (err) {
        throw new Error(`Failed to parse extracted JSON substring from LLM response: ${err instanceof Error ? err.message : String(err)}\nContent was: ${candidate.slice(0, 300)}...`);
      }
    }
  }

  throw new Error(`No valid JSON structure found in LLM response: ${clean.slice(0, 300)}...`);
}
