import { AggregatedReport, Finding, Severity } from '../types/index.js';

export function renderMarkdownReport(report: AggregatedReport): string {
  const verdictEmoji = report.verdict === 'PASS' ? '✅' : report.verdict === 'WARN' ? '⚠️' : '🚨';
  const durationSec = (report.durationMs / 1000).toFixed(1);

  const lines: string[] = [
    `## ${verdictEmoji} Codeward Code Review & Security Audit`,
    '',
    `> **Verdict:** **${report.verdict}** &mdash; ${report.summary}`,
    '',
    '| Target Diff | Engine | Files Audited | 🚨 Critical | ⚠️ Warning | 💡 Suggestion | Total Issues | Time |',
    '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |',
    `| \`${report.gitRef}\` | \`${report.provider} (${report.model})\` | ${report.stats.filesReviewed} | **${report.stats.critical}** | **${report.stats.warning}** | ${report.stats.suggestion} | **${report.stats.total}** | ${durationSec}s |`,
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('### ✨ Clean Audit Passed');
    lines.push('No security vulnerabilities, subtle logic bugs, or architectural regressions were identified in this changeset.');
    lines.push('');
    lines.push('---');
    lines.push('*Reviewed automatically by [Codeward](https://github.com/codeward-ai/codeward).*');
    return lines.join('\n');
  }

  lines.push('### Detailed Findings');
  lines.push('');

  // Group by file
  const fileGroups = new Map<string, Finding[]>();
  for (const f of report.findings) {
    const list = fileGroups.get(f.file) || [];
    list.push(f);
    fileGroups.set(f.file, list);
  }

  for (const [file, findings] of fileGroups.entries()) {
    const worstSeverity = findings.some((f) => f.severity === 'CRITICAL')
      ? '🚨 CRITICAL'
      : findings.some((f) => f.severity === 'WARNING')
      ? '⚠️ WARNING'
      : '💡 SUGGESTION';

    lines.push(`<details open>`);
    lines.push(`<summary><b><code>${file}</code> &mdash; ${worstSeverity} (${findings.length} issue${findings.length === 1 ? '' : 's'})</b></summary>`);
    lines.push('');

    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      const badge = f.severity === 'CRITICAL' ? '🔴 **CRITICAL**' : f.severity === 'WARNING' ? '🟡 **WARNING**' : '🔵 **SUGGESTION**';
      const lineSpan = f.endLine && f.endLine !== f.line ? `L${f.line}-L${f.endLine}` : `L${f.line}`;

      lines.push(`#### ${badge}: ${f.title}`);
      lines.push(`- **Location:** \`${file}:${lineSpan}\``);
      lines.push(`- **Rule:** \`${f.rule}\` &bull; **Agent:** \`${f.agent || 'analyzer'}\``);
      lines.push(`- **Details:** ${f.description}`);
      lines.push('');

      if (f.codeSnippet) {
        lines.push('**Vulnerable / Problematic Code:**');
        lines.push('```');
        lines.push(f.codeSnippet);
        lines.push('```');
        lines.push('');
      }

      if (f.suggestedFix) {
        lines.push('**Suggested Fix:**');
        lines.push('```suggestion');
        lines.push(f.suggestedFix);
        lines.push('```');
        lines.push('');
      }

      if (i < findings.length - 1) {
        lines.push('---');
        lines.push('');
      }
    }

    lines.push('</details>');
    lines.push('');
  }

  lines.push('---');
  lines.push('<sub>🛡️ Audited with multi-agent consensus by <b>Codeward</b>. To configure thresholds or custom prompts, see <code>.codewardrc.json</code>.</sub>');

  return lines.join('\n');
}
