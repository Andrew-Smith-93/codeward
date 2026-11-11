import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '../helpers/node-test.js';

const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/review.yml'), 'utf8');

describe('review workflow smoke configuration', () => {
  it('runs the checked-out local action with the offline mock provider', () => {
    expect(workflow).toContain('uses: ./');
    expect(workflow).toContain("provider: 'mock'");
    expect(workflow).toContain("comment-on-pr: 'false'");
    expect(workflow).not.toContain('OPENAI_API_KEY');
  });
});
