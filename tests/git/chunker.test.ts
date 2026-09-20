import { describe, it, expect } from 'vitest';
import { chunkDiffFiles } from '../../src/git/chunker.js';
import { DiffFile } from '../../src/types/index.js';

describe('Diff Chunker', () => {
  it('returns empty array when no files are provided', () => {
    expect(chunkDiffFiles([])).toEqual([]);
  });

  it('batches small files into a single chunk', () => {
    const files: DiffFile[] = [
      {
        oldPath: 'file1.ts',
        newPath: 'file1.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [],
        rawDiff: 'diff --git a/file1.ts b/file1.ts\n+const x = 1;',
      },
      {
        oldPath: 'file2.ts',
        newPath: 'file2.ts',
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        hunks: [],
        rawDiff: 'diff --git a/file2.ts b/file2.ts\n+const y = 2;',
      },
    ];

    const chunks = chunkDiffFiles(files, 5000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(1);
    expect(chunks[0].totalChunks).toBe(1);
    expect(chunks[0].fileCount).toBe(2);
    expect(chunks[0].diffText).toContain('file1.ts');
    expect(chunks[0].diffText).toContain('file2.ts');
  });

  it('splits into multiple chunks when exceeding maxChars', () => {
    const fileA: DiffFile = {
      oldPath: 'a.ts',
      newPath: 'a.ts',
      isNew: false,
      isDeleted: false,
      isRenamed: false,
      hunks: [],
      rawDiff: 'A'.repeat(300),
    };
    const fileB: DiffFile = {
      oldPath: 'b.ts',
      newPath: 'b.ts',
      isNew: false,
      isDeleted: false,
      isRenamed: false,
      hunks: [],
      rawDiff: 'B'.repeat(300),
    };

    const chunks = chunkDiffFiles([fileA, fileB], 400);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].chunkIndex).toBe(1);
    expect(chunks[0].totalChunks).toBe(2);
    expect(chunks[1].chunkIndex).toBe(2);
  });
});
