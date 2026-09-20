import fs from 'node:fs/promises';

export interface GitHubActionContext {
  isGitHubAction: boolean;
  isPullRequest: boolean;
  prNumber?: number;
  prTitle?: string;
  baseRef?: string;
  headRef?: string;
  repoFullName?: string;
  actor?: string;
}

export async function detectGitHubContext(): Promise<GitHubActionContext> {
  const isGitHubAction = !!process.env.GITHUB_ACTIONS;

  if (!isGitHubAction) {
    return {
      isGitHubAction: false,
      isPullRequest: false,
    };
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return {
      isGitHubAction: true,
      isPullRequest: false,
      actor: process.env.GITHUB_ACTOR,
      repoFullName: process.env.GITHUB_REPOSITORY,
    };
  }

  try {
    const raw = await fs.readFile(eventPath, 'utf-8');
    const event = JSON.parse(raw);

    if (event.pull_request) {
      return {
        isGitHubAction: true,
        isPullRequest: true,
        prNumber: event.pull_request.number,
        prTitle: event.pull_request.title,
        baseRef: event.pull_request.base?.ref,
        headRef: event.pull_request.head?.ref,
        repoFullName: event.repository?.full_name || process.env.GITHUB_REPOSITORY,
        actor: process.env.GITHUB_ACTOR,
      };
    }

    return {
      isGitHubAction: true,
      isPullRequest: false,
      repoFullName: event.repository?.full_name || process.env.GITHUB_REPOSITORY,
      actor: process.env.GITHUB_ACTOR,
    };
  } catch {
    return {
      isGitHubAction: true,
      isPullRequest: false,
      repoFullName: process.env.GITHUB_REPOSITORY,
      actor: process.env.GITHUB_ACTOR,
    };
  }
}
