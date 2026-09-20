import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectGitHubContext } from '../../src/git/github-context.js';

describe('GitHub Actions Context Detector', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeward-gh-test-'));
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects when not in GitHub Actions', async () => {
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_EVENT_PATH;

    const ctx = await detectGitHubContext();
    expect(ctx.isGitHubAction).toBe(false);
    expect(ctx.isPullRequest).toBe(false);
  });

  it('extracts PR metadata from GitHub event file', async () => {
    const eventFile = path.join(tmpDir, 'event.json');
    const eventData = {
      pull_request: {
        number: 42,
        title: 'feat: add user login endpoint',
        base: { ref: 'main' },
        head: { ref: 'feat/login' },
      },
      repository: {
        full_name: 'codeward-ai/codeward',
      },
    };

    await fs.writeFile(eventFile, JSON.stringify(eventData), 'utf-8');

    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_EVENT_PATH = eventFile;
    process.env.GITHUB_ACTOR = 'octocat';

    const ctx = await detectGitHubContext();
    expect(ctx.isGitHubAction).toBe(true);
    expect(ctx.isPullRequest).toBe(true);
    expect(ctx.prNumber).toBe(42);
    expect(ctx.baseRef).toBe('main');
    expect(ctx.headRef).toBe('feat/login');
    expect(ctx.repoFullName).toBe('codeward-ai/codeward');
    expect(ctx.actor).toBe('octocat');
  });
});
