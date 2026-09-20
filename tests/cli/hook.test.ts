import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { installGitHook } from '../../src/cli/hook.js';

describe('Git Hook Installer', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeward-hook-test-'));
    await fs.mkdir(path.join(tmpDir, '.git'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates executable pre-commit hook file in .git/hooks/', async () => {
    await installGitHook(tmpDir);

    const hookFile = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    const content = await fs.readFile(hookFile, 'utf-8');

    expect(content).toContain('codeward review --staged --fail-on critical');
    expect(content).toContain('Git commit aborted by Codeward');
  });

  it('throws error if not in git repo', async () => {
    const nonGit = await fs.mkdtemp(path.join(os.tmpdir(), 'non-git-'));
    await expect(installGitHook(nonGit)).rejects.toThrow(/No \.git directory found/);
    await fs.rm(nonGit, { recursive: true, force: true });
  });
});
