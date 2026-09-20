import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { GitExtractor } from '../git/diff-extractor.js';
import { chunkDiffFiles } from '../git/chunker.js';
import { resolveProvider } from '../providers/factory.js';
import { MultiAgentRunner } from '../agents/runner.js';
import { synthesizeReport } from '../synthesizer/aggregator.js';
import { renderTerminalReport } from '../reporters/terminal-reporter.js';
import { ReviewOptions } from '../types/index.js';
import { CodewardConfig } from '../config/loader.js';

const execFileAsync = promisify(execFile);

export async function runWatchMode(options: ReviewOptions, config: CodewardConfig): Promise<void> {
  console.clear();
  console.log(chalk.cyan.bold('🛡️  CODEWARD WATCH MODE ACTIVATED'));
  console.log(chalk.gray('Watching repository for uncommitted/staged git changes... (Press Ctrl+C to exit)\n'));

  let isRunning = false;
  let lastStatus = '';

  const checkAndRun = async () => {
    if (isRunning) return;

    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: process.cwd() });
      const currentStatus = stdout.trim();

      if (!currentStatus) {
        if (lastStatus !== '') {
          console.clear();
          console.log(chalk.cyan.bold('🛡️  CODEWARD WATCH MODE'));
          console.log(chalk.green('✓ Working directory clean. Waiting for changes...'));
          lastStatus = '';
        }
        return;
      }

      if (currentStatus === lastStatus) {
        return; // No new changes
      }

      lastStatus = currentStatus;
      isRunning = true;

      console.clear();
      console.log(chalk.cyan.bold('🛡️  CODEWARD WATCH MODE • Change Detected'));
      console.log(chalk.gray(new Date().toLocaleTimeString()) + '\n');

      const startTime = Date.now();
      const git = new GitExtractor();
      const { files, gitRef } = await git.extractReviewableDiff(options);

      if (files.length === 0) {
        console.log(chalk.yellow('No reviewable changes in modified files.'));
        isRunning = false;
        return;
      }

      const chunks = chunkDiffFiles(files);
      const provider = resolveProvider(options);
      const effectiveModel = options.model || config.model || provider.defaultModel;

      const runner = new MultiAgentRunner({
        provider,
        model: effectiveModel,
        enabledAgents: options.agents || config.agents,
        customPrompt: config.customPrompt,
        customRules: config.customRules,
      });

      const agentResults = await runner.run(chunks);
      const durationMs = Date.now() - startTime;

      const report = synthesizeReport(agentResults, {
        providerName: provider.name,
        modelName: effectiveModel,
        gitRef,
        filesReviewedCount: files.length,
        durationMs,
      });

      console.log(renderTerminalReport(report));
      console.log(chalk.dim('\nWatching for new changes...'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Watch error: ${msg}`));
    } finally {
      isRunning = false;
    }
  };

  // Initial check
  await checkAndRun();

  // Poll every 1.5s
  setInterval(checkAndRun, 1500);
}
