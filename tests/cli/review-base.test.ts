import { describe, expect, it } from '../helpers/node-test.js';
import { resolveReviewBase } from '../../src/cli/review-base.js';

const pullRequest = { isGitHubAction: true, isPullRequest: true, baseRef: 'main' };

describe('resolveReviewBase', () => {
  it('keeps PR worktree reviews independent of an inferred base branch', () => {
    expect(resolveReviewBase({ unstaged: true }, pullRequest)).toBe(undefined);
    expect(resolveReviewBase({ staged: true }, pullRequest)).toBe(undefined);
  });

  it('uses an explicitly requested base', () => {
    expect(resolveReviewBase({ base: 'origin/release' }, pullRequest)).toBe('origin/release');
  });

  it('uses the PR base for a default review', () => {
    expect(resolveReviewBase({}, pullRequest)).toBe('origin/main');
  });
});
