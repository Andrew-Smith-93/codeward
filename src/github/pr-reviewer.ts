import { AggregatedReport, Finding } from '../types/index.js';

export interface GitHubReviewOptions {
  repoOwner: string;
  repoName: string;
  pullNumber: number;
  commitSha?: string;
  githubToken: string;
  apiBaseUrl?: string;
}

export interface PRReviewSubmissionResult {
  reviewId?: number;
  url?: string;
  commentCount: number;
  event: 'REQUEST_CHANGES' | 'COMMENT';
}

/**
 * Submits line-level inline comments directly to GitHub Pull Request Review API.
 */
export async function submitGitHubPRReview(
  report: AggregatedReport,
  options: GitHubReviewOptions
): Promise<PRReviewSubmissionResult> {
  const apiBase = (options.apiBaseUrl || 'https://api.github.com').replace(/\/+$/, '');
  const url = `${apiBase}/repos/${options.repoOwner}/${options.repoName}/pulls/${options.pullNumber}/reviews`;

  const event: 'REQUEST_CHANGES' | 'COMMENT' = report.stats.critical > 0 ? 'REQUEST_CHANGES' : 'COMMENT';

  const comments: Array<{ path: string; line: number; side: 'RIGHT'; body: string }> = [];

  for (const f of report.findings) {
    const badge = f.severity === 'CRITICAL' ? '🔴 **CRITICAL**' : f.severity === 'WARNING' ? '🟡 **WARNING**' : '🔵 **SUGGESTION**';

    let body = `### ${badge}: ${f.title}\n\n` +
      `**Rule:** \`${f.rule}\` &bull; **Agent:** \`${f.agent || 'analyzer'}\`\n\n` +
      `${f.description}\n\n`;

    if (f.suggestedFix) {
      body += `**Suggested Fix:**\n\`\`\`suggestion\n${f.suggestedFix}\n\`\`\``;
    }

    comments.push({
      path: f.file,
      line: f.line,
      side: 'RIGHT',
      body,
    });
  }

  const payload: Record<string, unknown> = {
    body: `## 🛡️ Codeward Multi-Agent Review\n\n**Verdict:** **${report.verdict}** &mdash; ${report.summary}\n\nTotal findings: ${report.stats.total} (${report.stats.critical} Critical, ${report.stats.warning} Warning, ${report.stats.suggestion} Suggestion).`,
    event,
    comments,
  };

  if (options.commitSha) {
    payload.commit_id = options.commitSha;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${options.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`GitHub Review API submission failed (${res.status} ${res.statusText}): ${errText}`);
  }

  const data = (await res.json()) as { id?: number; html_url?: string };

  return {
    reviewId: data.id,
    url: data.html_url,
    commentCount: comments.length,
    event,
  };
}
