import { DiffFile, DiffHunk, DiffLine } from '../types/index.js';

/**
 * Parses unified git diff output into structured DiffFile and DiffHunk objects.
 */
export function parseDiff(rawDiff: string): DiffFile[] {
  if (!rawDiff || !rawDiff.trim()) {
    return [];
  }

  const files: DiffFile[] = [];
  const lines = rawDiff.split('\n');
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let currentFileLines: string[] = [];

  let oldLineNum = 0;
  let newLineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file header
    if (line.startsWith('diff --git ')) {
      if (currentFile) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
          currentHunk = null;
        }
        currentFile.rawDiff = currentFileLines.join('\n');
        files.push(currentFile);
        currentFileLines = [];
      }

      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const oldPath = match ? match[1] : 'unknown';
      const newPath = match ? match[2] : 'unknown';

      currentFile = {
        oldPath,
        newPath,
        isNew: false,
        isDeleted: false,
        isRenamed: oldPath !== newPath && oldPath !== 'unknown',
        hunks: [],
        rawDiff: '',
      };
      currentFileLines.push(line);
      continue;
    }

    if (!currentFile) {
      continue;
    }

    currentFileLines.push(line);

    if (line.startsWith('new file mode ')) {
      currentFile.isNew = true;
      continue;
    }

    if (line.startsWith('deleted file mode ')) {
      currentFile.isDeleted = true;
      continue;
    }

    if (line.startsWith('similarity index ') || line.startsWith('rename from ') || line.startsWith('rename to ')) {
      currentFile.isRenamed = true;
      continue;
    }

    // Detect hunk header: @@ -1,5 +1,6 @@ optional heading
    if (line.startsWith('@@ ')) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }

      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
      if (hunkMatch) {
        const oldStart = parseInt(hunkMatch[1], 10);
        const oldLines = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
        const newStart = parseInt(hunkMatch[3], 10);
        const newLines = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;
        const heading = hunkMatch[5].trim();

        oldLineNum = oldStart;
        newLineNum = newStart;

        currentHunk = {
          oldStart,
          oldLines,
          newStart,
          newLines,
          heading,
          lines: [],
          raw: line + '\n',
        };
      }
      continue;
    }

    // Inside a hunk
    if (currentHunk) {
      currentHunk.raw += line + '\n';

      if (line.startsWith('+')) {
        const diffLine: DiffLine = {
          type: 'add',
          content: line.slice(1),
          newLineNumber: newLineNum,
        };
        currentHunk.lines.push(diffLine);
        newLineNum++;
      } else if (line.startsWith('-')) {
        const diffLine: DiffLine = {
          type: 'del',
          content: line.slice(1),
          oldLineNumber: oldLineNum,
        };
        currentHunk.lines.push(diffLine);
        oldLineNum++;
      } else if (line.startsWith(' ') || line === '') {
        const diffLine: DiffLine = {
          type: 'normal',
          content: line.startsWith(' ') ? line.slice(1) : '',
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        };
        currentHunk.lines.push(diffLine);
        oldLineNum++;
        newLineNum++;
      }
    }
  }

  // Push final hunk and file
  if (currentFile) {
    if (currentHunk) {
      currentFile.hunks.push(currentHunk);
    }
    currentFile.rawDiff = currentFileLines.join('\n');
    files.push(currentFile);
  }

  return files;
}

/**
 * Returns formatted code snippet with line numbers from a hunk around a specific target line.
 */
export function extractSnippetAroundLine(hunk: DiffHunk, targetLine: number, contextRadius = 3): string {
  const matchingIndex = hunk.lines.findIndex((l) => l.newLineNumber === targetLine || l.oldLineNumber === targetLine);
  if (matchingIndex === -1) {
    return '';
  }

  const startIdx = Math.max(0, matchingIndex - contextRadius);
  const endIdx = Math.min(hunk.lines.length - 1, matchingIndex + contextRadius);

  const snippetLines: string[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const l = hunk.lines[i];
    const prefix = l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ';
    const lineNum = (l.newLineNumber ?? l.oldLineNumber ?? '').toString().padStart(4, ' ');
    const marker = (l.newLineNumber === targetLine || l.oldLineNumber === targetLine) ? '>' : ' ';
    snippetLines.push(`${marker} ${lineNum} ${prefix} ${l.content}`);
  }

  return snippetLines.join('\n');
}
