import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const project = process.cwd();
const script = path.join(project, 'scripts/action-smoke.sh');

async function fixture(run: (tmp: string, repo: string) => Promise<void>) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'codeward-action-fixture-'));
  const repo = path.join(tmp, 'repo');
  try {
    await fs.mkdir(repo);
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, {
        cwd: repo, stdio: 'ignore',
        env: { PATH: process.env.PATH, HOME: tmp, GIT_CONFIG_NOSYSTEM: '1' },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0);
    };
    const commit = (...args: string[]) => git('-c', 'user.name=Local Fixture',
      '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', ...args);
    git('init', '--quiet');
    commit('--allow-empty', '-m', 'Fixture base');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    await fs.writeFile(path.join(repo, 'fixture.ts'), 'export const value = 1;\n');
    git('add', 'fixture.ts');
    commit('-m', 'Benign change');
    await run(tmp, repo);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function smoke(tmp: string, repo: string, base: string) {
  const outcome = path.join(tmp, 'output');
  const stream = await fs.open(outcome, 'w');
  try {
    const result = spawnSync('/bin/bash', [script], {
      cwd: repo, stdio: ['ignore', stream.fd, stream.fd],
      env: { PATH: process.env.PATH, HOME: tmp, CODEWARD_ACTION_PATH: project, CODEWARD_BASE_REF: base },
    });
    assert.ifError(result.error);
    return { status: result.status, output: await fs.readFile(outcome, 'utf8') };
  } finally {
    await stream.close();
  }
}

test('the action script runs the packaged CLI on a benign diff, offline and without changing the checkout', async () => {
  await fixture(async (tmp, repo) => {
    const result = await smoke(tmp, repo, 'origin/main');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /offline smoke check \(mock output is not a security audit\)/);
    assert.match(result.output, /mock-llm-v1/);
    assert.deepEqual((await fs.readdir(repo)).sort(), ['.git', 'fixture.ts']);
    assert.equal(await fs.readFile(path.join(repo, 'fixture.ts'), 'utf8'), 'export const value = 1;\n');
  });
});

test('the action rejects non-remote and unavailable base refs without running a review', async () => {
  await fixture(async (tmp, repo) => {
    for (const [ref, message] of [
      ['main', /requires an origin remote-tracking branch/],
      ['origin/unavailable', /base branch is not available locally/],
    ] as const) {
      const result = await smoke(tmp, repo, ref);
      assert.equal(result.status, 1);
      assert.match(result.output, message);
      assert.doesNotMatch(result.output, /offline smoke check/);
    }
  });
});

test('the Action and its example workflow do not request credentials or write permissions', async () => {
  const action = await fs.readFile(path.join(project, 'action.yml'), 'utf8');
  const workflow = await fs.readFile(path.join(project, '.github/workflows/review.yml'), 'utf8');
  assert.match(action, /run: bash "\$CODEWARD_ACTION_PATH\/scripts\/action-smoke.sh"/);
  assert.doesNotMatch(action, /api-key:|github-token:|comment-on-pr:|npx |npm link|secrets\./);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /pull_request_target|: write|secrets\./);
});
