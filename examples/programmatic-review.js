/**
 * Example: Using Codeward programmatically in standard Node.js
 */

import { review, renderTerminalReport, renderMarkdownReport } from '../dist/index.js';

async function main() {
  console.log('Running Codeward review programmatically...');

  const report = await review({
    unstaged: true,
    provider: 'mock',
  });

  // Render to terminal
  console.log(renderTerminalReport(report));

  // Or get PR-formatted Markdown
  const markdown = renderMarkdownReport(report);
  console.log('\n--- Markdown Output Preview ---\n');
  console.log(markdown.slice(0, 300) + '...\n');
}

main().catch(console.error);
