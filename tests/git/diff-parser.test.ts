import { describe, it, expect } from 'vitest';
import { parseDiff, extractSnippetAroundLine } from '../../src/git/diff-parser.js';

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 83a21b..94b32c 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,8 @@ export function authenticateUser(token: string) {
   if (!token) {
     throw new Error("Missing token");
   }
+  const secret = "hardcoded-secret-key-123";
+  const query = "SELECT * FROM users WHERE token = '" + token + "'";
   return verifyToken(token, secret);
 }
diff --git a/src/utils.ts b/src/utils.ts
new file mode 100644
--- /dev/null
+++ b/src/utils.ts
@@ -0,0 +1,5 @@
+export function add(a: number, b: number): number {
+  return a + b;
+}
`;

describe('Diff Parser', () => {
  it('correctly parses multiple files from unified diff', () => {
    const files = parseDiff(SAMPLE_DIFF);
    expect(files).toHaveLength(2);

    const authFile = files[0];
    expect(authFile.oldPath).toBe('src/auth.ts');
    expect(authFile.newPath).toBe('src/auth.ts');
    expect(authFile.isNew).toBe(false);
    expect(authFile.hunks).toHaveLength(1);

    const hunk = authFile.hunks[0];
    expect(hunk.oldStart).toBe(10);
    expect(hunk.newStart).toBe(10);
    expect(hunk.lines.length).toBeGreaterThan(0);

    const addedLines = hunk.lines.filter((l) => l.type === 'add');
    expect(addedLines).toHaveLength(2);
    expect(addedLines[0].content).toContain('hardcoded-secret-key-123');
    expect(addedLines[0].newLineNumber).toBe(13);
    expect(addedLines[1].content).toContain("SELECT * FROM users WHERE token = '");
    expect(addedLines[1].newLineNumber).toBe(14);
  });

  it('detects new files correctly', () => {
    const files = parseDiff(SAMPLE_DIFF);
    const newFile = files[1];
    expect(newFile.newPath).toBe('src/utils.ts');
    expect(newFile.isNew).toBe(true);
    expect(newFile.hunks).toHaveLength(1);
    expect(newFile.hunks[0].lines[0].newLineNumber).toBe(1);
  });

  it('extracts snippet around target line', () => {
    const files = parseDiff(SAMPLE_DIFF);
    const hunk = files[0].hunks[0];
    const snippet = extractSnippetAroundLine(hunk, 13, 2);

    expect(snippet).toContain('>   13 +   const secret = "hardcoded-secret-key-123";');
    expect(snippet).toContain('14 +   const query =');
  });

  it('handles empty diff gracefully', () => {
    expect(parseDiff('')).toEqual([]);
    expect(parseDiff('   ')).toEqual([]);
  });
});
