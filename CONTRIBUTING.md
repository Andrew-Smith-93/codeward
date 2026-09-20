# Contributing to Codeward

Thank you for your interest in contributing to **Codeward**! We welcome bug reports, feature suggestions, custom agent contributions, and pull requests.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/codeward-ai/codeward.git
   cd codeward
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run TypeScript compiler in watch mode:**
   ```bash
   npm run watch
   ```

4. **Run unit and integration tests:**
   ```bash
   npm test
   ```

## Adding a New Agent

Codeward makes it trivial to add specialized review agents:
1. Extend `BaseAgent` in `src/agents/`:
   ```ts
   import { BaseAgent } from './base-agent.js';

   export class AccessibilityAuditorAgent extends BaseAgent {
     public readonly agentType = 'a11y-auditor';
     public readonly displayName = 'Accessibility Auditor';
     public readonly description = 'Audits web components for WCAG 2.1 compliance and ARIA roles.';

     getSystemPrompt(): string {
       return 'You are an accessibility specialist inspecting code changes...';
     }
   }
   ```
2. Register the agent in `MultiAgentRunner` (`src/agents/runner.ts`).
3. Add a unit test in `tests/agents/`.

## Pull Request Guidelines

- Ensure `npm test` passes completely before submitting.
- Verify `npm run build` succeeds without compiler warnings.
- Keep PRs focused on a single feature or bug fix.
- All PRs are automatically reviewed by Codeward in CI!
