import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { test } from 'node:test';
import { installGitHook } from '../../src/cli/hook.js';

async function withFixture(run: (cwd: string) => Promise<void>) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'codeward-hook-test-'));
  try {
    await fs.mkdir(path.join(cwd, '.git'));
    await run(cwd);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
}

test('generated hook calls only the absolute local runner and literal offline arguments', async () => {
  await withFixture(async (cwd) => {
    // This runner only records arguments. The test never runs reviews, npm, or a Git commit.
    const runner = path.join(cwd, "Codeward’s 'local' \$runner.cjs");
    const capture = path.join(cwd, 'actual-argv.json');
    await fs.writeFile(runner, "require('node:fs').writeFileSync(process.env.CAPTURE_FILE, JSON.stringify(process.argv.slice(2)));\n");
    await installGitHook(cwd, process.execPath, runner);

    const hookFile = path.join(cwd, '.git', 'hooks', 'pre-commit');
    assert.notEqual((await fs.stat(hookFile)).mode & 0o100, 0);
    const content = await fs.readFile(hookFile, 'utf8');
    assert.doesNotMatch(content, /\b(?:npx|npm)\b|API_KEY/);
    const run = spawnSync('/bin/sh', [hookFile], {
      cwd,
      stdio: 'ignore',
      env: { HOME: cwd, CAPTURE_FILE: capture },
    });
    assert.ifError(run.error);
    assert.equal(run.status, 0);
    assert.deepEqual(JSON.parse(await fs.readFile(capture, 'utf8')), [
      'review', '--staged', '--provider', 'mock', '--fail-on', 'none',
    ]);
  });
});

test('hook install leaves an existing pre-commit file intact', async () => {
  await withFixture(async (cwd) => {
    const hooksDir = path.join(cwd, '.git', 'hooks');
    const hook = path.join(hooksDir, 'pre-commit');
    const content = '# Existing inert fixture\n';
    await fs.mkdir(hooksDir);
    await fs.writeFile(hook, content, { mode: 0o700 });
    await assert.rejects(installGitHook(cwd, process.execPath, '/unused/cli.js'), /already exists/);
    assert.equal(await fs.readFile(hook, 'utf8'), content);
    assert.equal((await fs.stat(hook)).mode & 0o777, 0o700);
  });
});

test('hook install refuses a redirected hooks directory', async () => {
  await withFixture(async (cwd) => {
    const target = path.join(cwd, 'redirected');
    await fs.mkdir(target);
    await fs.symlink(target, path.join(cwd, '.git', 'hooks'));
    await assert.rejects(installGitHook(cwd, process.execPath, '/unused/cli.js'), /real .git\/hooks directory/);
    assert.deepEqual(await fs.readdir(target), []);
  });
});

test('hook install rejects a missing git repository and relative CLI paths', async () => {
  await withFixture(async (cwd) => {
    await assert.rejects(installGitHook(cwd, process.execPath, './relative-cli.js'), /absolute paths/);
    await assert.rejects(installGitHook(path.join(cwd, 'not-git'), process.execPath, '/unused/cli.js'), /No \.git directory found/);
  });
});
