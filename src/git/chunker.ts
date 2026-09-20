import { DiffFile } from '../types/index.js';

export interface DiffChunk {
  chunkIndex: number;
  totalChunks: number;
  files: DiffFile[];
  diffText: string;
  fileCount: number;
}

const DEFAULT_MAX_CHARS_PER_CHUNK = 25000; // ~6000 tokens

/**
 * Batches diff files into coherent chunks suitable for LLM review.
 */
export function chunkDiffFiles(
  files: DiffFile[],
  maxChars: number = DEFAULT_MAX_CHARS_PER_CHUNK
): DiffChunk[] {
  if (files.length === 0) {
    return [];
  }

  const chunks: { files: DiffFile[]; diffText: string }[] = [];
  let currentFiles: DiffFile[] = [];
  let currentChars = 0;

  for (const file of files) {
    const fileDiffLength = file.rawDiff.length;

    // If single file exceeds maxChars, handle it
    if (fileDiffLength > maxChars && currentFiles.length > 0) {
      // Flush current files first
      chunks.push({
        files: [...currentFiles],
        diffText: currentFiles.map((f) => f.rawDiff).join('\n\n'),
      });
      currentFiles = [];
      currentChars = 0;
    }

    if (fileDiffLength > maxChars) {
      // If single file is huge, push it as its own chunk
      chunks.push({
        files: [file],
        diffText: file.rawDiff,
      });
    } else if (currentChars + fileDiffLength > maxChars && currentFiles.length > 0) {
      // Chunk limit reached, push and start new chunk
      chunks.push({
        files: [...currentFiles],
        diffText: currentFiles.map((f) => f.rawDiff).join('\n\n'),
      });
      currentFiles = [file];
      currentChars = fileDiffLength;
    } else {
      currentFiles.push(file);
      currentChars += fileDiffLength;
    }
  }

  if (currentFiles.length > 0) {
    chunks.push({
      files: [...currentFiles],
      diffText: currentFiles.map((f) => f.rawDiff).join('\n\n'),
    });
  }

  const total = chunks.length;
  return chunks.map((c, index) => ({
    chunkIndex: index + 1,
    totalChunks: total,
    files: c.files,
    diffText: c.diffText,
    fileCount: c.files.length,
  }));
}
