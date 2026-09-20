import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

export async function installGitHook(cwd: string = process.cwd()): Promise<void> {
  const gitDir = path.join(cwd, '.git');
  try {
    const stat = await fs.stat(gitDir);
    if (!stat.isDirectory()) {
      throw new Error('Not a git repository.');
    }
  } catch {
    throw new Error('No .git directory found. Please run this inside the root of a git repository.');
  }

  const hooksDir = path.join(gitDir, 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });

  const preCommitPath = path.join(hooksDir, 'pre-commit');

  const hookContent = `#!/bin/sh
# Codeward pre-commit security and correctness hook
echo "🛡️  Running Codeward pre-commit code review..."

npx codeward review --staged --fail-on critical

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "✖ Git commit aborted by Codeward due to critical security or logic flaws."
  echo "Tip: Run 'npx codeward fix --staged' to auto-patch, or inspect with 'npx codeward review --staged'."
  exit $EXIT_CODE
fi
`;

  await fs.writeFile(preCommitPath, hookContent, { mode: 0o755 });
  console.log(chalk.green.bold('✓ Codeward pre-commit hook installed successfully!'));
  console.log(chalk.gray(`  Hook path: ${preCommitPath}`));
  console.log(chalk.cyan('Staged commits will now be audited for critical vulnerabilities automatically.'));
}
