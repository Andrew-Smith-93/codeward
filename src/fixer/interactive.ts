import readline from 'node:readline/promises';
import chalk from 'chalk';
import { Finding } from '../types/index.js';
import { applyFixes, FixResult } from './patcher.js';

export async function promptAndApplyFixes(
  findings: Finding[],
  autoConfirm: boolean = false,
  rootDir: string = process.cwd()
): Promise<FixResult[]> {
  const fixable = findings.filter((f) => f.suggestedFix && f.suggestedFix.trim().length > 0);

  if (fixable.length === 0) {
    console.log(chalk.yellow('No actionable code fixes available for the detected findings.'));
    return [];
  }

  console.log(chalk.bold.cyan(`\n🔧 AUTO-FIX ENGINE: ${fixable.length} fixable issue(s) found.\n`));

  if (autoConfirm || !process.stdin.isTTY) {
    console.log(chalk.gray('Auto-confirm enabled: applying all suggested fixes...'));
    const results = await applyFixes(fixable, rootDir);
    printFixSummary(results);
    return results;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const confirmedFindings: Finding[] = [];
  let applyRemaining = false;

  for (let i = 0; i < fixable.length; i++) {
    const f = fixable[i];
    const indexStr = `#${i + 1}/${fixable.length}`;

    if (applyRemaining) {
      confirmedFindings.push(f);
      continue;
    }

    console.log(chalk.bold(`${indexStr} [${f.severity}] ${f.title}`));
    console.log(`   ${chalk.dim('File:')} ${chalk.cyan(`${f.file}:${f.line}`)}`);

    if (f.codeSnippet) {
      console.log(chalk.red(`   - Current:   ${f.codeSnippet.split('\n')[0]}`));
    }
    if (f.suggestedFix) {
      console.log(chalk.green(`   + Proposed:  ${f.suggestedFix.split('\n')[0]}`));
    }

    const answer = (await rl.question(chalk.yellow('   Apply this fix? [y]es / [n]o / [a]ll / [q]uit: '))).trim().toLowerCase();

    if (answer === 'y' || answer === 'yes') {
      confirmedFindings.push(f);
    } else if (answer === 'a' || answer === 'all') {
      confirmedFindings.push(f);
      applyRemaining = true;
    } else if (answer === 'q' || answer === 'quit') {
      console.log(chalk.gray('Aborting remaining fixes.'));
      break;
    }
    console.log('');
  }

  rl.close();

  if (confirmedFindings.length === 0) {
    console.log(chalk.gray('No fixes selected.'));
    return [];
  }

  const results = await applyFixes(confirmedFindings, rootDir);
  printFixSummary(results);
  return results;
}

function printFixSummary(results: FixResult[]): void {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(chalk.bold(`\nFix Application Summary:`));
  console.log(`  ${chalk.green(`✓ Successfully patched: ${successCount}`)}`);
  if (failCount > 0) {
    console.log(`  ${chalk.red(`✖ Failed to patch: ${failCount}`)}`);
    for (const r of results.filter((r) => !r.success)) {
      console.log(chalk.red(`    - ${r.file}:${r.line}: ${r.error}`));
    }
  }
  console.log('');
}
