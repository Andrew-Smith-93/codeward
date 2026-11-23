import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

function quoteShellArg(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export async function installGitHook(cwd: string, nodePath: string, cliPath: string): Promise<void> {
  if (![nodePath, cliPath].every(file => path.isAbsolute(file) && !file.includes('\0'))) {
    throw new Error('Codeward hook requires absolute paths to Node.js and the local CLI.');
  }

  const gitDir = path.join(cwd, '.git');
  try {
    const stat = await fs.lstat(gitDir);
    if (!stat.isDirectory()) {
      throw new Error('Not a git repository.');
    }
  } catch {
    throw new Error('No .git directory found. Please run this inside the root of a git repository.');
  }

  const hooksDir = path.join(gitDir, 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });
  if (!(await fs.lstat(hooksDir)).isDirectory()) {
    throw new Error('Refusing to write outside a real .git/hooks directory.');
  }
  const preCommitPath = path.join(hooksDir, 'pre-commit');

  const hookContent = `#!/bin/sh
# Codeward offline smoke check; this is not a security audit.
echo "Running Codeward offline pre-commit smoke check..."
exec ${quoteShellArg(nodePath)} ${quoteShellArg(cliPath)} review --staged --provider mock --fail-on none
`;

  try {
    await fs.writeFile(preCommitPath, hookContent, { mode: 0o755, flag: 'wx' });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`A pre-commit hook already exists and was left unchanged: ${preCommitPath}`);
    }
    throw err;
  }
  console.log(chalk.green.bold('✓ Codeward pre-commit hook installed successfully!'));
  console.log(chalk.gray(`  Hook path: ${preCommitPath}`));
  console.log('The hook uses this local Codeward checkout and the offline mock provider. It is not a security audit.');
}
