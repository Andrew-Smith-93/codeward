import { AggregatedReport, Finding } from '../types/index.js';

/**
 * Emits GitHub Actions workflow commands (::error and ::warning)
 * so GitHub natively renders inline diff annotations on the PR "Files changed" tab.
 */
export function emitGitHubAnnotations(report: AggregatedReport): void {
  // Only emit if running inside GitHub Actions
  if (!process.env.GITHUB_ACTIONS) {
    return;
  }

  for (const finding of report.findings) {
    const command = finding.severity === 'CRITICAL' ? 'error' : finding.severity === 'WARNING' ? 'warning' : 'notice';

    const params: string[] = [
      `file=${escapeProperty(finding.file)}`,
      `line=${finding.line}`,
    ];

    if (finding.endLine && finding.endLine > finding.line) {
      params.push(`endLine=${finding.endLine}`);
    }

    params.push(`title=${escapeProperty(`[${finding.rule}] ${finding.title}`)}`);

    const message = escapeData(
      `${finding.description}\n` +
      (finding.suggestedFix ? `\nSuggested Fix:\n${finding.suggestedFix}` : '')
    );

    console.log(`::${command} ${params.join(',')}::${message}`);
  }
}

function escapeProperty(val: string): string {
  return val
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

function escapeData(val: string): string {
  return val
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}
