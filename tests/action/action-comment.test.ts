import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const postReport = require(path.join(process.cwd(), 'scripts/action-comment.cjs'));
const title = 'Codeward Code Review & Security Audit';

async function scenario(comments: unknown[], report: string | undefined, lookupFails = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeward-comment-'));
  const created: any[] = [], updated: any[] = [], warnings: string[] = [];
  let lookups = 0;
  const reportPath = path.join(dir, 'report.md');
  if (report !== undefined) fs.writeFileSync(reportPath, report);
  const github = {
    graphql: async () => { lookups++; if (lookupFails) throw new Error('unavailable'); return { viewer: { login: 'review-bot' } }; },
    paginate: async (_method: unknown, params: any) => { assert.equal(params.per_page, 100); return comments; },
    rest: { issues: {
      listComments: () => {},
      createComment: async (args: any) => { created.push(args); },
      updateComment: async (args: any) => { updated.push(args); },
    } },
  };
  try {
    await postReport({ github, context: { repo: { owner: 'owner', repo: 'repo' }, issue: { number: 7 } },
      core: { info: () => {}, warning: (text: string) => warnings.push(text) }, reportPath });
    return { created, updated, warnings, lookups };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

describe('Action PR comments', () => {
  it('does not post when the current invocation has no report or an empty report', async () => {
    for (const report of [undefined, '  ']) {
      const result = await scenario([], report);
      assert.equal(result.created.length + result.updated.length + result.lookups, 0);
    }
  });
  it('ignores another author and updates only the authenticated author', async () => {
    const result = await scenario([
      { id: 1, body: title, user: { login: 'someone-else' } },
      { id: 2, body: null, user: { login: 'review-bot' } },
      { id: 3, body: title, user: { login: 'review-bot' } },
    ], 'fresh report');
    assert.equal(result.updated[0].comment_id, 3);
    assert.equal(result.created.length, 0);
    assert.match(result.updated[0].body, /fresh report/);
  });
  it('creates a marked comment when only another author matches', async () => {
    const result = await scenario([{ id: 1, body: title, user: { login: 'other' } }], 'fresh');
    assert.equal(result.updated.length, 0);
    assert.equal(result.created[0].body, '<!-- codeward-review -->\nfresh');
  });
  it('updates its own marked comment even without the old title', async () => {
    const result = await scenario([{ id: 9, body: '<!-- codeward-review -->\nold', user: { login: 'review-bot' } }], 'fresh');
    assert.equal(result.updated[0].comment_id, 9);
  });
  it('warns and creates a new comment if identity cannot be established', async () => {
    const result = await scenario([{ id: 1, body: title, user: { login: 'review-bot' } }], 'fresh', true);
    assert.equal(result.updated.length, 0);
    assert.equal(result.created.length, 1);
    assert.equal(result.warnings.length, 1);
  });
});
