import fs from 'node:fs/promises';
import path from 'node:path';
import { Finding } from '../types/index.js';

export interface FixResult {
  findingId?: string;
  file: string;
  line: number;
  success: boolean;
  error?: string;
}

/**
 * Applies suggested fixes directly to files on disk.
 * Sorts findings in descending line order per file to preserve line offsets.
 */
export async function applyFixes(
  findings: Finding[],
  rootDir: string = process.cwd()
): Promise<FixResult[]> {
  const fixable = findings.filter((f) => f.suggestedFix && f.suggestedFix.trim().length > 0);
  if (fixable.length === 0) {
    return [];
  }

  // Group by file
  const fileGroups = new Map<string, Finding[]>();
  for (const f of fixable) {
    const list = fileGroups.get(f.file) || [];
    list.push(f);
    fileGroups.set(f.file, list);
  }

  const results: FixResult[] = [];

  for (const [relPath, fileFindings] of fileGroups.entries()) {
    const absPath = path.resolve(rootDir, relPath);

    let content: string;
    try {
      content = await fs.readFile(absPath, 'utf-8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const f of fileFindings) {
        results.push({
          findingId: f.id,
          file: relPath,
          line: f.line,
          success: false,
          error: `Cannot read file: ${msg}`,
        });
      }
      continue;
    }

    // Sort findings in descending order of starting line
    const sorted = [...fileFindings].sort((a, b) => b.line - a.line);
    const lines = content.split('\n');

    for (const f of sorted) {
      if (!f.suggestedFix) continue;

      const startIdx = f.line - 1;
      const endIdx = (f.endLine ? f.endLine : f.line) - 1;

      if (startIdx < 0 || startIdx >= lines.length) {
        results.push({
          findingId: f.id,
          file: relPath,
          line: f.line,
          success: false,
          error: `Line ${f.line} is out of file bounds (total lines: ${lines.length})`,
        });
        continue;
      }

      // If codeSnippet is provided, check if it matches in the region
      const replacementLines = f.suggestedFix.split('\n');
      const deleteCount = Math.max(1, endIdx - startIdx + 1);

      lines.splice(startIdx, deleteCount, ...replacementLines);

      results.push({
        findingId: f.id,
        file: relPath,
        line: f.line,
        success: true,
      });
    }

    try {
      await fs.writeFile(absPath, lines.join('\n'), 'utf-8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const res of results.filter((r) => r.file === relPath)) {
        res.success = false;
        res.error = `Cannot write updated file: ${msg}`;
      }
    }
  }

  return results;
}
