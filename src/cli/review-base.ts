import type { GitHubActionContext } from '../git/github-context.js';

interface ReviewTargetOptions {
  base?: string;
  staged?: boolean;
  unstaged?: boolean;
}

/** Explicit change-set modes review the worktree directly, even in a PR job. */
export function resolveReviewBase(options: ReviewTargetOptions, context: GitHubActionContext): string | undefined {
  if (options.base) return options.base;
  if (options.staged || options.unstaged) return undefined;
  if (context.isPullRequest && context.baseRef) return `origin/${context.baseRef}`;
  return undefined;
}
