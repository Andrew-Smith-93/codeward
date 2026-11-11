import { afterEach, describe, expect, it } from '../helpers/node-test.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const actionScript = path.join(repoRoot, 'scripts/action-review.sh');
const actionDefinition = fs.readFileSync(path.join(repoRoot, 'action.yml'), 'utf8');
const tempDirs: string[] = [];

function getReviewStepScript() {
  const step = actionDefinition.match(
    /- name: Run Multi-Agent Review[\s\S]*?      run: \|\n([\s\S]*?)(?=\n    - name: Comment on PR)/,
  )?.[1];
  if (step === undefined) throw new Error('Could not find the Run Multi-Agent Review shell block');
  return step.split(/\r?\n/).map((line) => line.startsWith('        ') ? line.slice(8) : line).join('\n');
}

function runActionScript(
  overrides: Record<string, string | undefined> = {},
  options: { cwd?: string; useActionYamlBlock?: boolean } = {},
) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeward-action-test-'));
  tempDirs.push(tempDir);

  const binDir = path.join(tempDir, 'bin');
  fs.mkdirSync(binDir);
  const captureFile = path.join(tempDir, 'capture.json');
  const fakeCli = path.join(binDir, 'codeward');
  fs.writeFileSync(fakeCli, `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(process.env.CAPTURE_FILE, JSON.stringify({
  args: process.argv.slice(2),
  keys: [process.env.OPENAI_API_KEY, process.env.ANTHROPIC_API_KEY, process.env.GEMINI_API_KEY],
  cwd: process.cwd(),
}));
`);
  fs.chmodSync(fakeCli, 0o755);

  const invocationScript = options.useActionYamlBlock
    ? path.join(tempDir, 'action-review-step.sh')
    : actionScript;
  if (options.useActionYamlBlock) fs.writeFileSync(invocationScript, getReviewStepScript());

  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
    CAPTURE_FILE: captureFile,
    RUNNER_TEMP: tempDir,
    GITHUB_OUTPUT: path.join(tempDir, 'outputs'),
    INPUT_BASE_BRANCH: 'origin/main',
    INPUT_PROVIDER: 'openai',
    INPUT_FAIL_ON: 'critical',
    INPUT_AGENTS: 'security,logic,performance',
    INPUT_MODEL: '',
    INPUT_API_URL: '',
    CODEWARD_ACTION_PATH: repoRoot,
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    GEMINI_API_KEY: '',
    ...overrides,
  };

  execFileSync('bash', [invocationScript], { env, cwd: options.cwd ?? repoRoot, stdio: 'ignore' });
  const captured = JSON.parse(fs.readFileSync(captureFile, 'utf8'));
  const reportPath = fs.readFileSync(path.join(tempDir, 'outputs'), 'utf8').trim().slice('report-path='.length);
  return { ...captured, reportPath } as {
    reportPath: string;
    args: string[];
    keys: string[];
    cwd: string;
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('GitHub Action review invocation', () => {
  it('runs the actual action.yml review step from the caller repository', () => {
    const callerRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'codeward-action-caller-'));
    tempDirs.push(callerRepo);
    fs.mkdirSync(path.join(callerRepo, '.git'));

    const captured = runActionScript({}, { cwd: callerRepo, useActionYamlBlock: true });

    expect(captured.cwd).toBe(callerRepo);
    expect(fs.existsSync(path.join(callerRepo, '.git'))).toBe(true);
    expect(captured.cwd).not.toBe(repoRoot);
  });

  it('passes space- and shell-sensitive inputs as literal argv values', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeward-action-marker-'));
    tempDirs.push(tempDir);
    const markerPath = path.join(tempDir, 'unexpected-file');
    const base = `feature branch; touch ${markerPath}`;
    const model = `model name; touch ${markerPath}`;
    const apiUrl = `https://api.example.invalid/a b; touch ${markerPath}`;
    const captured = runActionScript({
      INPUT_BASE_BRANCH: base,
      INPUT_MODEL: model,
      INPUT_API_URL: apiUrl,
    });

    expect(captured.args).toEqual([
      'review', '--base', base, '--provider', 'openai', '--fail-on', 'critical',
      '--agents', 'security,logic,performance', '--pr', '--output',
      captured.reportPath, '--model', model, '--api-url', apiUrl,
    ]);
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('allocates a different absent report for every invocation', () => {
    const first = runActionScript();
    fs.writeFileSync(first.reportPath, 'stale report');
    const second = runActionScript();
    expect(second.reportPath).not.toBe(first.reportPath);
    expect(fs.existsSync(second.reportPath)).toBe(false);
    expect(actionDefinition).toContain('CODEWARD_REPORT_PATH: ${{ steps.review.outputs.report-path }}');
  });

  it('keeps the API key out of argv and works without a key', () => {
    const secret = 'offline-test-secret';
    const withKey = runActionScript({ OPENAI_API_KEY: secret });
    expect(withKey.args).not.toContain('--api-key');
    expect(withKey.args.join(' ')).not.toContain(secret);
    expect(withKey.keys).toEqual([secret, '', '']);

    const withoutKey = runActionScript();
    expect(withoutKey.args).not.toContain('--api-key');
    expect(withoutKey.keys).toEqual(['', '', '']);
  });

  it('requires the explicit comment opt-in while still allowing failure reports', () => {
    expect(actionDefinition).toContain(
      "if: ${{ always() && inputs.comment-on-pr == 'true' && inputs.github-token != '' && github.event_name == 'pull_request' }}",
    );
    expect(actionDefinition).not.toContain('inputs.comment-on-pr == \'true\' || success() || failure()');
  });
});
