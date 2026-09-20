import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { AggregatedReport, Finding, Severity } from '../types/index.js';

export function renderTerminalReport(report: AggregatedReport): string {
  const parts: string[] = [];

  // Header Box
  const verdictColor = report.verdict === 'PASS'
    ? chalk.green.bold
    : report.verdict === 'WARN'
    ? chalk.yellow.bold
    : chalk.red.bold;

  const verdictIcon = report.verdict === 'PASS' ? '✓' : report.verdict === 'WARN' ? '⚠' : '✖';
  const durationSec = (report.durationMs / 1000).toFixed(1);

  const headerContent = [
    `${chalk.bold.cyan('🛡️  CODEWARD')}  ${chalk.gray(`v1.0.0`)}  ${chalk.dim('• Multi-Agent Code Review & Security Audit')}`,
    '',
    `  ${chalk.bold('Verdict:')}     ${verdictColor(`${verdictIcon} ${report.verdict}`)}`,
    `  ${chalk.bold('Summary:')}     ${report.summary}`,
    `  ${chalk.bold('Git Target:')}  ${chalk.cyan(report.gitRef)}`,
    `  ${chalk.bold('Engine:')}      ${chalk.magenta(`${report.provider} (${report.model})`)}`,
    `  ${chalk.bold('Duration:')}    ${chalk.gray(`${durationSec}s`)}`,
  ].join('\n');

  parts.push(
    boxen(headerContent, {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderColor: report.verdict === 'PASS' ? 'green' : report.verdict === 'WARN' ? 'yellow' : 'red',
      borderStyle: 'round',
    })
  );

  // Stats Table
  const table = new Table({
    head: [
      chalk.bold('Files Reviewed'),
      chalk.bold('Agents Active'),
      chalk.red.bold('Critical'),
      chalk.yellow.bold('Warning'),
      chalk.cyan.bold('Suggestion'),
      chalk.bold('Total'),
    ],
    style: { head: [], border: [] },
  });

  table.push([
    report.stats.filesReviewed,
    report.stats.agentsRan,
    report.stats.critical > 0 ? chalk.red.bold(report.stats.critical) : chalk.green('0'),
    report.stats.warning > 0 ? chalk.yellow.bold(report.stats.warning) : chalk.green('0'),
    report.stats.suggestion > 0 ? chalk.cyan.bold(report.stats.suggestion) : '0',
    report.stats.total > 0 ? chalk.bold(report.stats.total) : chalk.green('0'),
  ]);

  parts.push(table.toString());
  parts.push('');

  // Findings Details
  if (report.findings.length === 0) {
    parts.push(
      chalk.green.bold('✨ Clean bill of health! No security vulnerabilities, edge-case bugs, or performance issues detected.')
    );
    parts.push('');
    return parts.join('\n');
  }

  parts.push(chalk.bold.underline(`REVIEW FINDINGS (${report.findings.length})`));
  parts.push('');

  for (let i = 0; i < report.findings.length; i++) {
    const f = report.findings[i];
    parts.push(formatTerminalFinding(f, i + 1));
  }

  return parts.join('\n');
}

function formatTerminalFinding(finding: Finding, index: number): string {
  const badge = getSeverityBadge(finding.severity);
  const agentTag = finding.agent ? chalk.dim(`[${finding.agent}]`) : '';
  const ruleTag = chalk.gray(`(${finding.rule})`);
  const fileLink = chalk.cyan.underline(`${finding.file}:${finding.line}${finding.endLine ? `-${finding.endLine}` : ''}`);

  const lines: string[] = [
    `${chalk.bold(`#${index}`)} ${badge} ${chalk.bold(finding.title)}`,
    `   ${chalk.dim('Location:')} ${fileLink}  ${ruleTag}  ${agentTag}`,
    `   ${chalk.dim('Details:')}  ${finding.description}`,
  ];

  if (finding.codeSnippet) {
    lines.push(`   ${chalk.dim('Snippet:')}`);
    const snippetLines = finding.codeSnippet.split('\n');
    for (const s of snippetLines) {
      lines.push(`     ${chalk.red('│')} ${chalk.gray(s)}`);
    }
  }

  if (finding.suggestedFix) {
    lines.push(`   ${chalk.green.bold('Suggested Fix:')}`);
    const fixLines = finding.suggestedFix.split('\n');
    for (const s of fixLines) {
      lines.push(`     ${chalk.green('│')} ${chalk.white(s)}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function getSeverityBadge(severity: Severity): string {
  switch (severity) {
    case 'CRITICAL':
      return chalk.bgRed.black.bold(' CRITICAL ');
    case 'WARNING':
      return chalk.bgYellow.black.bold(' WARNING ');
    case 'SUGGESTION':
      return chalk.bgCyan.black.bold(' SUGGESTION ');
  }
}
