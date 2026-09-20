import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { GitExtractor } from '../git/diff-extractor.js';
import { chunkDiffFiles } from '../git/chunker.js';
import { resolveProvider } from '../providers/factory.js';
import { MultiAgentRunner } from '../agents/runner.js';
import { loadCustomAgents } from '../agents/plugin-loader.js';
import { sanitizeAndFilterFindings, verifyCriticalFindings } from '../agents/verifier.js';
import { synthesizeReport } from '../synthesizer/aggregator.js';
import { renderTerminalReport } from '../reporters/terminal-reporter.js';
import { renderMarkdownReport } from '../reporters/markdown-reporter.js';
import { renderJsonReport } from '../reporters/json-reporter.js';
import { renderSarifReport } from '../reporters/sarif-reporter.js';
import { renderHtmlReport } from '../reporters/html-reporter.js';
import { emitGitHubAnnotations } from '../reporters/github-annotations.js';
import { detectGitHubContext } from '../git/github-context.js';
import { loadConfig } from '../config/loader.js';
import { promptAndApplyFixes } from '../fixer/interactive.js';
import { submitGitHubPRReview } from '../github/pr-reviewer.js';
import { runWatchMode } from './watch.js';
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
  .option('-f, --format <format>', 'Output format: terminal, markdown, json, sarif, html', 'terminal')
  .option('-o, --output <file>', 'Save output report to file')
  .option('--html <file>', 'Export interactive HTML report to file')
  .option('--fail-on <severity>', 'Fail with exit code 1 if issues found (critical, warning, suggestion, none)')
  .option('-a, --agents <agents>', 'Comma-separated agents to run: security, logic, performance')
  .option('--pr', 'Output GitHub PR-formatted Markdown')
  .option('--fix', 'Interactively apply suggested code fixes')
  .option('-y, --yes', 'Automatically apply all fixes without prompting (with --fix)')
  .option('--verify-critical', 'Run second-pass verifier on critical findings to eliminate false alarms')
  .option('--exclude <patterns>', 'Comma-separated file patterns to ignore')
  .option('-c, --config <path>', 'Path to custom configuration file')
  .option('-v, --verbose', 'Show verbose debug information')
  .action(async (opts) => {
    const startTime = Date.now();

    try {
      // 1. Load config file (.codewardrc.json)
      const config = await loadConfig(opts.config);

      // 2. Detect GitHub Actions / PR environment
      const ghContext = await detectGitHubContext();

      let targetBase = opts.base;
      if (!opts.base && ghContext.isPullRequest && ghContext.baseRef) {
        targetBase = `origin/${ghContext.baseRef}`;
        if (opts.verbose) {
          console.log(chalk.gray(`Detected GitHub PR #${ghContext.prNumber}: diffing against ${targetBase}`));
        }
      }

      const format = opts.pr ? 'markdown' : (opts.format || 'terminal').toLowerCase();
      const failOn = (opts.failOn || config.failOn || 'critical').toLowerCase() as FailOnThreshold;

      const reviewOptions: ReviewOptions = {
        base: targetBase,
        staged: opts.staged,
        unstaged: opts.unstaged,
        provider: opts.provider || config.provider,
        model: opts.model || config.model,
        apiKey: opts.apiKey,
        apiUrl: opts.apiUrl || config.apiUrl,
        format: format as 'terminal' | 'markdown' | 'json',
        output: opts.output,
        failOn,
        agents: opts.agents
          ? opts.agents.split(',').map((a: string) => a.trim())
          : config.agents,
        exclude: opts.exclude
          ? opts.exclude.split(',').map((e: string) => e.trim())
          : config.exclude,
        verbose: !!opts.verbose,
        pr: !!opts.pr,
      };

      // 3. Git Extraction & Filtering
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

      // 4. Diff Chunking
      const chunks = chunkDiffFiles(files);

      // 5. Provider Setup
      const provider = resolveProvider(reviewOptions);
      const effectiveModel = reviewOptions.model || provider.defaultModel;

      // 6. Custom Agent Plugins
      const customAgents = await loadCustomAgents(config);

      // 7. Parallel Multi-Agent Execution
      const runner = new MultiAgentRunner({
        provider,
        model: effectiveModel,
        enabledAgents: reviewOptions.agents,
        verbose: reviewOptions.verbose,
        customPrompt: config.customPrompt,
        customRules: config.customRules,
        customAgents,
      });

      const agentResults = await runner.run(chunks);

      // 8. Synthesis & Deduplication
      const durationMs = Date.now() - startTime;
      let report = synthesizeReport(agentResults, {
        providerName: provider.name,
        modelName: effectiveModel,
        gitRef,
        filesReviewedCount: files.length,
        durationMs,
      });

      // 9. False-Positive Filtering & Verification
      report.findings = sanitizeAndFilterFindings(report.findings);
      if (opts.verifyCritical && report.stats.critical > 0) {
        if (opts.verbose) {
          console.log(chalk.gray('Running second-opinion verification on critical findings...'));
        }
        report.findings = await verifyCriticalFindings(report.findings, provider, effectiveModel);
      }

      // 10. GitHub Actions Inline Workflow Commands
      emitGitHubAnnotations(report);

      // 11. Format Output
      let rendered = '';
      if (format === 'json') {
        rendered = renderJsonReport(report);
      } else if (format === 'markdown') {
        rendered = renderMarkdownReport(report);
      } else if (format === 'sarif') {
        rendered = renderSarifReport(report);
      } else if (format === 'html') {
        rendered = renderHtmlReport(report);
      } else {
        rendered = renderTerminalReport(report);
      }

      // Save HTML report if --html requested
      if (opts.html) {
        const htmlPath = path.resolve(process.cwd(), opts.html);
        await fs.mkdir(path.dirname(htmlPath), { recursive: true });
        await fs.writeFile(htmlPath, renderHtmlReport(report), 'utf-8');
        console.log(chalk.green(`Interactive HTML report saved to: ${htmlPath}`));
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

      // 12. Auto-Fix Execution
      if (opts.fix) {
        await promptAndApplyFixes(report.findings, !!opts.yes);
      }

      // 13. CI Exit Code Evaluation
      let shouldFail = false;
      const maxCritical = config.maxCritical ?? 0;
      const maxWarning = config.maxWarning ?? 100;

      if (failOn !== 'none') {
        if (report.stats.critical > maxCritical) {
          shouldFail = true;
        }

        if (report.stats.warning > maxWarning) {
          shouldFail = true;
        }

        if (failOn === 'critical' && report.stats.critical > 0) {
          shouldFail = true;
        } else if (failOn === 'warning' && (report.stats.critical > 0 || report.stats.warning > 0)) {
          shouldFail = true;
        } else if (failOn === 'suggestion' && report.stats.total > 0) {
          shouldFail = true;
        }
      }

      if (shouldFail) {
        if (format === 'terminal') {
          console.error(chalk.red.bold(`\n✖ Review failed quality gate (${failOn} threshold / max critical: ${maxCritical}).`));
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
  .command('fix')
  .description('Review changes and interactively apply suggested code fixes')
  .option('-b, --base <branch>', 'Base git branch to diff against')
  .option('-s, --staged', 'Review only staged changes')
  .option('-u, --unstaged', 'Review unstaged working tree changes')
  .option('-p, --provider <provider>', 'LLM provider')
  .option('-m, --model <model>', 'LLM model')
  .option('-y, --yes', 'Automatically apply all fixes without prompting')
  .option('-c, --config <path>', 'Path to custom configuration file')
  .action(async (opts) => {
    try {
      const config = await loadConfig(opts.config);
      const reviewOptions: ReviewOptions = {
        base: opts.base,
        staged: opts.staged,
        unstaged: opts.unstaged,
        provider: opts.provider || config.provider,
        model: opts.model || config.model,
        agents: config.agents,
        exclude: config.exclude,
      };

      const git = new GitExtractor();
      const { files, gitRef } = await git.extractReviewableDiff(reviewOptions);

      if (files.length === 0) {
        console.log(chalk.yellow(`No reviewable changes found for target "${gitRef}".`));
        return;
      }

      const chunks = chunkDiffFiles(files);
      const provider = resolveProvider(reviewOptions);
      const effectiveModel = reviewOptions.model || provider.defaultModel;

      const runner = new MultiAgentRunner({
        provider,
        model: effectiveModel,
        enabledAgents: reviewOptions.agents,
        customPrompt: config.customPrompt,
        customRules: config.customRules,
      });

      const agentResults = await runner.run(chunks);
      const report = synthesizeReport(agentResults, {
        providerName: provider.name,
        modelName: effectiveModel,
        gitRef,
        filesReviewedCount: files.length,
        durationMs: 0,
      });

      console.log(renderTerminalReport(report));
      await promptAndApplyFixes(report.findings, !!opts.yes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Fix error: ${message}`));
      process.exit(1);
    }
  });

program
  .command('pr <number>')
  .description('Audit a GitHub Pull Request and submit line-by-line review comments')
  .option('--owner <owner>', 'GitHub repository owner')
  .option('--repo <repo>', 'GitHub repository name')
  .option('--token <token>', 'GitHub personal access token (defaults to GITHUB_TOKEN)')
  .option('-p, --provider <provider>', 'LLM provider')
  .option('-m, --model <model>', 'LLM model')
  .option('-c, --config <path>', 'Path to custom configuration file')
  .action(async (prNumberStr, opts) => {
    try {
      const prNumber = parseInt(prNumberStr, 10);
      if (isNaN(prNumber) || prNumber <= 0) {
        throw new Error(`Invalid PR number: ${prNumberStr}`);
      }

      const token = opts.token || process.env.GITHUB_TOKEN;
      if (!token) {
        throw new Error('GitHub token missing. Pass --token <token> or set GITHUB_TOKEN environment variable.');
      }

      let owner = opts.owner;
      let repo = opts.repo;

      if (!owner || !repo) {
        if (process.env.GITHUB_REPOSITORY) {
          const [o, r] = process.env.GITHUB_REPOSITORY.split('/');
          owner = owner || o;
          repo = repo || r;
        } else {
          // Attempt to extract from git remote
          const git = new GitExtractor();
          const ctx = await git.getGitContext();
          // Fallback prompt
          if (!owner || !repo) {
            throw new Error('Please specify --owner <owner> and --repo <repo>.');
          }
        }
      }

      console.log(chalk.cyan(`Auditing GitHub PR #${prNumber} on ${owner}/${repo}...`));

      // Fetch PR diff from GitHub API
      const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
      const diffRes = await fetch(diffUrl, {
        headers: {
          Accept: 'application/vnd.github.v3.diff',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!diffRes.ok) {
        throw new Error(`Failed to fetch PR diff (${diffRes.status}): ${await diffRes.text()}`);
      }

      const rawDiff = await diffRes.text();
      const config = await loadConfig(opts.config);
      const provider = resolveProvider({ provider: opts.provider || config.provider });

      const { parseDiff } = await import('../git/diff-parser.js');
      const { shouldIgnoreFile } = await import('../git/filter.js');
      const parsed = parseDiff(rawDiff);
      const files = parsed.filter((f) => !shouldIgnoreFile(f.newPath, config.exclude));

      if (files.length === 0) {
        console.log(chalk.green('No reviewable changes in PR.'));
        return;
      }

      const chunks = chunkDiffFiles(files);
      const runner = new MultiAgentRunner({
        provider,
        model: opts.model || config.model,
        enabledAgents: config.agents,
      });

      const results = await runner.run(chunks);
      const report = synthesizeReport(results, {
        providerName: provider.name,
        modelName: opts.model || provider.defaultModel,
        gitRef: `PR #${prNumber}`,
        filesReviewedCount: files.length,
        durationMs: 0,
      });

      console.log(renderTerminalReport(report));

      console.log(chalk.gray(`Submitting line-level review comments to PR #${prNumber}...`));
      const submission = await submitGitHubPRReview(report, {
        repoOwner: owner,
        repoName: repo,
        pullNumber: prNumber,
        githubToken: token,
      });

      console.log(chalk.green.bold(`✓ Submitted PR Review: ${submission.event} (${submission.commentCount} line comments posted).`));
      if (submission.url) {
        console.log(chalk.cyan(`Review URL: ${submission.url}`));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`PR command failed: ${message}`));
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Live review loop on file save/staging in local git workspace')
  .option('-s, --staged', 'Watch only staged changes')
  .option('-p, --provider <provider>', 'LLM provider')
  .option('-m, --model <model>', 'LLM model')
  .option('-a, --agents <agents>', 'Comma-separated agents to run')
  .option('-c, --config <path>', 'Path to custom configuration file')
  .action(async (opts) => {
    try {
      const config = await loadConfig(opts.config);
      const reviewOptions: ReviewOptions = {
        staged: !!opts.staged,
        provider: opts.provider || config.provider,
        model: opts.model || config.model,
        agents: opts.agents ? opts.agents.split(',').map((a: string) => a.trim()) : config.agents,
        exclude: config.exclude,
      };

      await runWatchMode(reviewOptions, config);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Watch command failed: ${message}`));
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
        customRules: [
          {
            id: 'TEAM-001',
            name: 'Require strict tenant validation',
            description: 'All database queries must include tenant_id filter.',
            severity: 'CRITICAL',
          },
        ],
      };

      const workflowContent = `name: Codeward Multi-Agent Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  security-events: write # Required for SARIF upload

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
      console.log('  3. Run `codeward watch` for real-time live review while coding.');
      console.log('  4. Run `codeward fix` to interactively apply AI suggested fixes.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Init failed: ${message}`));
      process.exit(1);
    }
  });

program.parse();
