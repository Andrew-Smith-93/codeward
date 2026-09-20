import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DiffFile, ReviewOptions } from '../types/index.js';
import { parseDiff } from './diff-parser.js';
import { shouldIgnoreFile } from './filter.js';

const execFileAsync = promisify(execFile);

export interface GitContext {
  branch: string;
  commit: string;
  repoRoot: string;
  isRepo: boolean;
}

export class GitExtractor {
  constructor(private cwd: string = process.cwd()) {}

  /**
   * Validates if directory is a git repository and gets basic context.
   */
  async getGitContext(): Promise<GitContext> {
    try {
      const { stdout: rootOut } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: this.cwd });
      const repoRoot = rootOut.trim();

      const { stdout: branchOut } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: this.cwd });
      const branch = branchOut.trim();

      const { stdout: commitOut } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: this.cwd });
      const commit = commitOut.trim();

      return {
        branch,
        commit,
        repoRoot,
        isRepo: true,
      };
    } catch {
      return {
        branch: 'unknown',
        commit: 'unknown',
        repoRoot: this.cwd,
        isRepo: false,
      };
    }
  }

  /**
   * Fetches git diff based on provided review options.
   */
  async getDiff(options: ReviewOptions): Promise<{ rawDiff: string; gitRef: string }> {
    const gitArgs: string[] = ['diff', '-U3'];

    let gitRef = 'working-tree';

    if (options.base) {
      // Comparison against base branch
      gitArgs.push(`${options.base}...HEAD`);
      gitRef = `${options.base}...HEAD`;
    } else if (options.staged) {
      gitArgs.push('--cached');
      gitRef = 'staged (index)';
    } else if (options.unstaged) {
      gitRef = 'unstaged (working tree)';
    } else {
      // Default: staged first, fallback to unstaged if empty, or both
      // Check staged diff
      try {
        const { stdout: stagedOut } = await execFileAsync('git', ['diff', '--cached', '-U3'], { cwd: this.cwd });
        if (stagedOut && stagedOut.trim().length > 0) {
          return { rawDiff: stagedOut, gitRef: 'staged (index)' };
        }
      } catch {
        // Continue to unstaged
      }
      gitRef = 'working-tree (unstaged)';
    }

    try {
      const { stdout } = await execFileAsync('git', gitArgs, {
        cwd: this.cwd,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });
      return { rawDiff: stdout, gitRef };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to extract git diff (${gitArgs.join(' ')}): ${message}`);
    }
  }

  /**
   * Extracts and filters diff files according to ignore rules.
   */
  async extractReviewableDiff(options: ReviewOptions): Promise<{
    files: DiffFile[];
    gitRef: string;
    rawDiff: string;
    ignoredFiles: string[];
  }> {
    const { rawDiff, gitRef } = await this.getDiff(options);
    const parsedFiles = parseDiff(rawDiff);

    const ignoredFiles: string[] = [];
    const files: DiffFile[] = [];

    const customExcludes = options.exclude ?? [];

    for (const file of parsedFiles) {
      const pathToCheck = file.newPath !== 'unknown' ? file.newPath : file.oldPath;
      if (shouldIgnoreFile(pathToCheck, customExcludes)) {
        ignoredFiles.push(pathToCheck);
      } else {
        files.push(file);
      }
    }

    return {
      files,
      gitRef,
      rawDiff,
      ignoredFiles,
    };
  }
}
