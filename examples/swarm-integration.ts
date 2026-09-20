/**
 * Example: Integrating Codeward as an Auditor / QA Agent inside an AI Agent Swarm
 * 
 * In this pattern:
 * 1. A "Coder Agent" writes or modifies code in the working tree.
 * 2. Codeward runs an automated multi-agent security and correctness review.
 * 3. If critical flaws or bugs are found, findings are passed back to the Coder Agent to fix!
 */

import { review, fix, AggregatedReport } from '../dist/index.js';

async function agentSwarmPipeline() {
  console.log('🤖 [Swarm] Coder Agent finished writing feature code.');
  console.log('🛡️ [Swarm] Invoking Codeward multi-agent auditor...');

  // Run Codeward review on uncommitted working changes
  const report: AggregatedReport = await review({
    unstaged: true,
    provider: 'mock', // Or 'openai', 'anthropic', 'gemini', 'ollama'
  });

  console.log(`\n📊 [Swarm] Audit complete! Verdict: ${report.verdict}`);
  console.log(`Summary: ${report.summary}`);

  if (report.verdict === 'PASS') {
    console.log('✅ [Swarm] Code passed all security, logic, and performance gates!');
    console.log('🚀 [Swarm] Safe to commit and push.');
    return;
  }

  console.log(`⚠️ [Swarm] Found ${report.stats.total} issue(s). Filtering critical flaws...`);

  for (const finding of report.findings) {
    console.log(`  - [${finding.severity}] ${finding.title} in ${finding.file}:${finding.line}`);
  }

  // Autonomous Remediation: Auto-apply suggested fixes
  console.log('\n🔧 [Swarm] Deploying Codeward Auto-Fixer to patch issues...');
  const { fixResults } = await fix({ unstaged: true, provider: 'mock' }, true);

  const applied = fixResults.filter((r) => r.success).length;
  console.log(`🎉 [Swarm] Successfully auto-patched ${applied} issue(s)!`);
}

agentSwarmPipeline().catch(console.error);
