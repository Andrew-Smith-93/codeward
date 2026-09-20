import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { GitExtractor } from '../git/diff-extractor.js';
import { chunkDiffFiles } from '../git/chunker.js';
import { resolveProvider } from '../providers/factory.js';
import { MultiAgentRunner } from '../agents/runner.js';
import { synthesizeReport } from '../synthesizer/aggregator.js';
import { renderTerminalReport } from '../reporters/terminal-reporter.js';
import { renderMarkdownReport } from '../reporters/markdown-reporter.js';
import { renderJsonReport } from '../reporters/json-reporter.js';
import { FailOnThreshold, ReviewOptions } from '../types/index.js';

// Load environment variables (.env)
dotenv.config();

const program = new Command();

program
  .name('codeward')
  .description('Multi-agent code review and security audit CLI and GitHub Action')
  .version('1.0.0');

program
  .command('review')
  .description('Perform multi-agent code review on git diff or pull request')
  .option('-b, --base <branch>', 'Base git branch to diff against (e.g. main, origin/main)')
  .option('-s, --staged', 'Review only staged changes')
  .option('-u, --unstaged', 'Review unstaged working tree changes')
  .option('-p, --provider <provider>', 'LLM provider (openai, anthropic, gemini, ollama, mock)')
  .option('-m, --model <model>', 'Override default model for the selected provider')
  .option('--api-key <key>', 'Provider API key (defaults to env var)')
  .option('--api-url <url>', 'Custom API base URL')
  .option('-f, --format <format>', 'Output format: terminal, markdown, json', 'terminal')
  .option('-o, --output <file>', 'Save output report to file')
  .option('--fail-on <severity>', 'Fail with exit code 1 if issues found (critical, warning, suggestion, none)', 'critical')
  .option('-a, --agents <agents>', 'Comma-separated agents to run: security, logic, performance')
  .option('--pr', 'Output GitHub PR-formatted Markdown')
  .option('--exclude <patterns>', 'Comma-separated file patterns to ignore')
  .option('-v, --verbose', 'Show verbose debug information')
  .action(async (opts) => {
    const startTime = Date.now();

    try {
      const format = opts.pr ? 'markdown' : (opts.format || 'terminal').toLowerCase();
      const failOn = (opts.failOn || 'critical').toLowerCase() as FailOnThreshold;

      const reviewOptions: ReviewOptions = {
        base: opts.base,
        staged: opts.staged,
        unstaged: opts.unstaged,
        provider: opts.provider,
        model: opts.model,
        apiKey: opts.apiKey,
        apiUrl: opts.apiUrl,
        format: format as 'terminal' | 'markdown' | 'json',
        output: opts.output,
        failOn,
        agents: opts.agents ? opts.agents.split(',').map((a: string) => a.trim()) : undefined,
        exclude: opts.exclude ? opts.exclude.split(',').map((e: string) => e.trim()) : undefined,
        verbose: !!opts.verbose,
        pr: !!opts.pr,
      };

      // 1. Git Extraction & Filtering
      const git = new GitExtractor();
      const gitContext = await git.getGitContext();

      if (!gitContext.isRepo) {
        console.error(chalk.red('Error: Not a git repository. Codeward must be run inside a git repository.'));
        process.exit(1);
      }

      if (opts.verbose) {
        console.log(chalk.gray(`Branch: ${gitContext.branch} | Commit: ${gitContext.commit} | Root: ${gitContext.repoRoot}`));
      }

      const { files, gitRef, ignoredFiles } = await git.extractReviewableDiff(reviewOptions);

      if (opts.verbose && ignoredFiles.length > 0) {
        console.log(chalk.gray(`Ignored ${ignoredFiles.length} file(s) (lockfiles, binaries, or excluded patterns).`));
      }

      if (files.length === 0) {
        console.log(chalk.yellow(`\nNo reviewable changes found for target "${gitRef}".`));
        console.log(chalk.gray('Tip: Make changes or use --staged / --base <branch> to target diffs.'));
        process.exit(0);
      }

      // 2. Diff Chunking
      const chunks = chunkDiffFiles(files);

      // 3. Provider Setup
      const provider = resolveProvider(reviewOptions);
      const effectiveModel = opts.model || provider.defaultModel;

      // 4. Parallel Multi-Agent Execution
      const runner = new MultiAgentRunner({
        provider,
        model: effectiveModel,
        enabledAgents: reviewOptions.agents,
        verbose: reviewOptions.verbose,
      });

      const agentResults = await runner.run(chunks);

      // 5. Synthesis & Deduplication
      const durationMs = Date.now() - startTime;
      const report = synthesizeReport(agentResults, {
        providerName: provider.name,
        modelName: effectiveModel,
        gitRef,
        filesReviewedCount: files.length,
        durationMs,
      });

      // 6. Format Output
      let rendered = '';
      if (format === 'json') {
        rendered = renderJsonReport(report);
      } else if (format === 'markdown') {
        rendered = renderMarkdownReport(report);
      } else {
        rendered = renderTerminalReport(report);
      }

      // Print or write to file
      if (opts.output) {
        const outPath = path.resolve(process.cwd(), opts.output);
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, rendered, 'utf-8');
        console.log(chalk.green(`Report saved to: ${outPath}`));
      }

      if (format !== 'terminal' || !opts.output) {
        console.log(rendered);
      }

      // 7. CI Exit Code Evaluation
      let shouldFail = false;
      if (failOn === 'critical' && report.stats.critical > 0) {
        shouldFail = true;
      } else if (failOn === 'warning' && (report.stats.critical > 0 || report.stats.warning > 0)) {
        shouldFail = true;
      } else if (failOn === 'suggestion' && report.stats.total > 0) {
        shouldFail = true;
      }

      if (shouldFail) {
        if (format === 'terminal') {
          console.error(chalk.red.bold(`\n✖ Review failed due to --fail-on ${failOn} threshold.`));
        }
        process.exit(1);
      }

      process.exit(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`\nError: ${message}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Scaffold Codeward configuration and GitHub Action workflow')
  .action(async () => {
    try {
      const cwd = process.cwd();
      const configPath = path.join(cwd, '.codewardrc.json');
      const workflowDir = path.join(cwd, '.github', 'workflows');
      const workflowPath = path.join(workflowDir, 'codeward-review.yml');

      const configContent = {
        $schema: 'https://raw.githubusercontent.com/codeward-ai/codeward/main/schema.json',
        provider: 'openai',
        model: 'gpt-4o-mini',
        failOn: 'critical',
        agents: ['security', 'logic', 'performance'],
        exclude: ['**/*.spec.ts', '**/*.test.ts'],
      };

      const workflowContent = `name: Codeward Multi-Agent Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    name: Multi-Agent Code Review
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Codeward Review
        uses: codeward-ai/codeward@v1
        with:
          provider: 'openai'
          model: 'gpt-4o-mini'
          api-key: \${{ secrets.OPENAI_API_KEY }}
          github-token: \${{ secrets.GITHUB_TOKEN }}
          fail-on: 'critical'
`;

      await fs.writeFile(configPath, JSON.stringify(configContent, null, 2), 'utf-8');
      await fs.mkdir(workflowDir, { recursive: true });
      await fs.writeFile(workflowPath, workflowContent, 'utf-8');

      console.log(chalk.green.bold('✓ Codeward initialized successfully!'));
      console.log(chalk.gray(`  Created: ${configPath}`));
      console.log(chalk.gray(`  Created: ${workflowPath}`));
      console.log(chalk.cyan('\nNext steps:'));
      console.log('  1. Add OPENAI_API_KEY to your GitHub repository secrets.');
      console.log('  2. Run `codeward review --base main` to test locally.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Init failed: ${message}`));
      process.exit(1);
    }
  });

program.parse();
