const fs = require('node:fs');
const marker = '<!-- codeward-review -->';

module.exports = async function postReport({ github, context, core, reportPath }) {
  if (!reportPath || !fs.existsSync(reportPath)) {
    core.info('No report from this invocation to comment.');
    return;
  }
  const report = fs.readFileSync(reportPath, 'utf8');
  if (!report.trim()) {
    core.info('This invocation produced an empty report.');
    return;
  }
  const body = `${marker}\n${report}`;
  const target = { owner: context.repo.owner, repo: context.repo.repo, issue_number: context.issue.number };
  let login;
  try {
    const { viewer } = await github.graphql('query { viewer { login } }');
    login = viewer?.login;
  } catch {
    core.warning('Could not identify the comment author; creating a new comment instead of editing an existing one.');
  }
  let existing;
  if (login) {
    const comments = await github.paginate(github.rest.issues.listComments, { ...target, per_page: 100 });
    existing = comments.find(c => c.user?.login === login && typeof c.body === 'string' &&
      (c.body.startsWith(marker) || c.body.includes('Codeward Code Review & Security Audit')));
  }
  if (existing) {
    await github.rest.issues.updateComment({ owner: target.owner, repo: target.repo, comment_id: existing.id, body });
    core.info('Updated existing Codeward PR comment.');
  } else {
    await github.rest.issues.createComment({ ...target, body });
    core.info('Created new Codeward PR comment.');
  }
};
