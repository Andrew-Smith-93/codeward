import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../bin/codeward.js', import.meta.url));

async function withFixture(run: (cwd: string) => Promise<void>) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'codeward-init-test-'));
  try {
    await run(cwd);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
}

async function init(cwd: string) {
  const stderrPath = path.join(cwd, '.test-stderr');
  const stderr = await fs.open(stderrPath, 'wx');
  try {
    const result = spawnSync(process.execPath, [cli, 'init'], {
      cwd,
      env: { HOME: cwd },
      stdio: ['ignore', 'ignore', stderr.fd],
    });
    assert.ifError(result.error);
    return { status: result.status, stderr: await fs.readFile(stderrPath, 'utf8') };
  } finally {
    await stderr.close();
    await fs.unlink(stderrPath);
  }
}

test('init creates only an offline config with the first-party schema', async () => {
  await withFixture(async (cwd) => {
    const first = await init(cwd);
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(await fs.readdir(cwd), ['.codewardrc.json']);
    const configPath = path.join(cwd, '.codewardrc.json');
    const content = await fs.readFile(configPath, 'utf8');
    assert.deepEqual(JSON.parse(content), {
      $schema: 'https://raw.githubusercontent.com/Andrew-Smith-93/codeward/e08724f9ff4f9922099651117ff74bb1872e480c/schema.json',
      provider: 'mock',
      failOn: 'none',
    });

    const second = await init(cwd);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /already exists and was left unchanged/);
    assert.equal(await fs.readFile(configPath, 'utf8'), content);
  });
});

test('init preserves an existing workflow and config without shadowing aliases', async () => {
  await withFixture(async (cwd) => {
    const config = '{ "provider": "mock", "customPrompt": "fixture" }\n';
    const workflowDir = path.join(cwd, '.github', 'workflows');
    const workflowPath = path.join(workflowDir, 'codeward-review.yml');
    const workflow = '# Existing inert fixture\n';
    await fs.mkdir(workflowDir, { recursive: true });
    await fs.writeFile(workflowPath, workflow);

    for (const filename of ['.codewardrc.json', '.codewardrc', 'codeward.config.json']) {
      const configPath = path.join(cwd, filename);
      await fs.writeFile(configPath, config);
      const result = await init(cwd);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /already exists and was left unchanged/);
      assert.deepEqual((await fs.readdir(cwd)).sort(), ['.github', filename].sort());
      assert.equal(await fs.readFile(configPath, 'utf8'), config);
      await fs.unlink(configPath);
    }

    const result = await init(cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await fs.readdir(workflowDir), ['codeward-review.yml']);
    assert.equal(await fs.readFile(workflowPath, 'utf8'), workflow);
  });
});

test('init does not follow an existing config symlink', async () => {
  await withFixture(async (cwd) => {
    const target = path.join(cwd, 'fixture.json');
    await fs.writeFile(target, '{}');
    await fs.symlink(target, path.join(cwd, '.codewardrc.json'));
    assert.equal((await init(cwd)).status, 1);
    assert.equal(await fs.readFile(target, 'utf8'), '{}');
    assert.equal((await fs.lstat(path.join(cwd, '.codewardrc.json'))).isSymbolicLink(), true);
  });
});
