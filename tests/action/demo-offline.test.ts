import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('the README demo runs the built checkout on one mock-only staged file and cleans up', async () => {
  const checkout = process.cwd();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codeward-demo-contract-'));
  try {
    const caller = path.join(root, 'caller folder');
    await fs.mkdir(caller);
    const fixtureFile = path.join(caller, 'keep.txt');
    await fs.writeFile(fixtureFile, 'untouched\n');
    const outputPath = path.join(root, 'output');
    const output = await fs.open(outputPath, 'wx');
    try {
      const readme = await fs.readFile(path.join(checkout, 'README.md'), 'utf8');
      assert(readme.includes('bash "$CODEWARD_DIR/scripts/demo-offline.sh"'));
      const result = spawnSync('bash', [path.join(checkout, 'scripts/demo-offline.sh')], {
        cwd: caller,
        env: { PATH: process.env.PATH, HOME: root, TMPDIR: root },
        stdio: ['ignore', output.fd, output.fd],
      });
      assert.ifError(result.error);
      const report = await fs.readFile(outputPath, 'utf8');
      assert.equal(result.status, 0, report);
      assert.match(report, /Offline mock demo: findings are synthetic, not a security verdict\./);
      assert.match(report, /staged \(index\).*mock \(mock-llm-v1\).*\| 1 \|/);
      assert.equal(await fs.readFile(fixtureFile, 'utf8'), 'untouched\n');
      assert.deepEqual(await fs.readdir(caller), ['keep.txt']);
      assert.deepEqual((await fs.readdir(root)).sort(), ['caller folder', 'output']);
    } finally {
      await output.close();
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
