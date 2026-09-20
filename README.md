<p align="center">
  <pre align="center">
  ██████╗ ██████╗ ██████╗ ███████╗██╗    ██╗ █████╗ ██████╗ ██████╗ 
 ██╔════╝██╔═══██╗██╔══██╗██╔════╝██║    ██║██╔══██╗██╔══██╗██╔══██╗
 ██║     ██║   ██║██║  ██║█████╗  ██║ █╗ ██║███████║██████╔╝██║  ██║
 ██║     ██║   ██║██║  ██║██╔══╝  ██║███╗██║██╔══██║██╔══██╗██║  ██║
 ╚██████╗╚██████╔╝██████╔╝███████╗╚███╔███╔╝██║  ██║██║  ██║██████╔╝
  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ 
  </pre>
</p>

<p align="center">
  <b>Multi-Agent AI Code Reviews & Security Audits for Git Diffs and Pull Requests</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codeward"><img src="https://img.shields.io/npm/v/codeward?color=brightgreen&label=npm%20package" alt="npm version" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg" alt="Node Version" /></a>
  <a href="https://github.com/codeward-ai/codeward/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple.svg" alt="License: MIT" /></a>
  <a href="https://github.com/features/actions"><img src="https://img.shields.io/badge/GitHub%20Action-Ready-2088FF.svg" alt="GitHub Action" /></a>
  <a href="https://owasp.org/www-project-top-ten/"><img src="https://img.shields.io/badge/Security-OWASP%20Top%2010-red.svg" alt="OWASP Top 10" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-Strict-3178C6.svg" alt="TypeScript Strict" /></a>
</p>

---

## ⚡ Overview

**Codeward** is a fast, modular CLI tool and GitHub Action that performs multi-agent code reviews and automated security audits on your Git diffs.

Instead of relying on a single generic prompt, Codeward deploys a team of **specialized AI personas** in parallel:
- 🛡️ **Security Sentinel**: Hunt down exposed secrets, SQL/command injection, IDOR, SSRF, XSS, and OWASP Top 10 vulnerabilities.
- ⚡ **Logic & Reliability Hound**: Uncover edge cases, unhandled promises, race conditions, null dereferences, and boundary regressions.
- 🚀 **Performance & Architecture Critic**: Diagnose N+1 query patterns, memory leaks, unnecessary re-renders, and breaking API contracts.

All findings pass through an intelligent **Synthesis & Deduplication Engine** that eliminates noise, aggregates cross-agent insights, ranks by severity (`CRITICAL`, `WARNING`, `SUGGESTION`), and outputs actionable fixes directly to your terminal or PR comments.

---

## 🎥 Demo

<p align="center">
  <img src="https://raw.githubusercontent.com/codeward-ai/codeward/main/assets/demo-placeholder.svg" width="800" alt="Codeward Terminal Review Demo" />
  <br />
  <em>Codeward Terminal TUI displaying color-coded severity badges, code snippets, and suggested diffs.</em>
</p>

---

## 🏗️ Architecture

```
                           ┌─────────────────────────┐
                           │        Git Diff         │
                           │  (staged / base branch) │
                           └────────────┬────────────┘
                                        │
                                        ▼
                           ┌─────────────────────────┐
                           │    Filter & Chunker     │
                           │  • Ignore lockfiles/bins│
                           │  • Smart chunk batches  │
                           └────────────┬────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
    ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
    │ Agent 1:        │        │ Agent 2:        │        │ Agent 3:        │
    │ Security        │        │ Logic &         │        │ Performance &   │
    │ Sentinel        │        │ Reliability     │        │ Architecture    │
    │ (OWASP, Secrets)│        │ (Async, Regress)│        │ (N+1, Leaks)    │
    └────────┬────────┘        └────────┬────────┘        └────────┬────────┘
             │                          │                          │
             └──────────────────────────┼──────────────────────────┘
                                        │
                                        ▼
                           ┌─────────────────────────┐
                           │  Synthesis Engine       │
                           │  • Deduplicate overlaps │
                           │  • Prioritize severity  │
                           │  • Score confidence     │
                           └────────────┬────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
    ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
    │ Terminal UI     │        │ GitHub PR       │        │ Structured JSON │
    │ (Chalk / Boxen) │        │ Markdown Report │        │ (CI Automation) │
    └─────────────────┘        └─────────────────┘        └─────────────────┘
```

---

## 🚀 Quickstart

### 1. Install Globally or Run via npx

```bash
# Install globally
npm install -g codeward

# Or run directly via npx
npx codeward review --staged
```

### 2. Configure Your Provider

Set an API key for your preferred provider:

```bash
# OpenAI (GPT-4o / GPT-4o-mini)
export OPENAI_API_KEY="sk-..."

# Anthropic (Claude 3.5 Sonnet)
export ANTHROPIC_API_KEY="sk-ant-..."

# Google Gemini (Gemini 2.0 Flash / 1.5 Pro)
export GEMINI_API_KEY="AIza..."

# Local Open-Source Models via Ollama (No API key required!)
export OLLAMA_BASE_URL="http://localhost:11434"
```

### 3. Run Your First Review

```bash
# Review currently staged changes
codeward review --staged

# Review working branch against main
codeward review --base main

# Review with Claude 3.5 Sonnet
codeward review --base origin/main --provider anthropic

# Offline / Dry-run test mode
codeward review --staged --provider mock
```

---

## 🤖 The Review Agent Ensemble

| Agent | Specialty | What It Catches |
| :--- | :--- | :--- |
| **🛡️ Security Sentinel** | AppSec, OWASP Top 10, Auth | Hardcoded keys, SQL/NoSQL injection, Command injection, SSRF, IDOR, XSS, Path traversal, weak hashing. |
| **⚡ Logic Hound** | Correctness, Edge Cases | Unhandled promise rejections, race conditions, off-by-one loops, null dereferencing, swallowed errors. |
| **🚀 Performance Critic** | Scalability, System Architecture | N+1 queries, memory leaks, uncleaned subscriptions, O(n²) bottlenecks, breaking API changes. |

You can run all three agents (default) or select specific ones:
```bash
codeward review --base main --agents security,logic
```

---

## 📋 CLI Reference

```
Usage: codeward review [options]

Perform multi-agent code review on git diff or pull request

Options:
  -b, --base <branch>        Base git branch to diff against (e.g. main, origin/main)
  -s, --staged               Review only staged changes (git diff --cached)
  -u, --unstaged             Review unstaged working tree changes
  -p, --provider <provider>  LLM provider: openai, anthropic, gemini, ollama, mock
  -m, --model <model>        Override default model for the selected provider
  --api-key <key>            Provider API key (defaults to env var)
  --api-url <url>            Custom API base URL (OpenAI-compatible / proxies)
  -f, --format <format>      Output format: terminal, markdown, json (default: "terminal")
  -o, --output <file>        Save output report to file
  --fail-on <severity>       Exit with code 1 if issues found: critical, warning, suggestion, none (default: "critical")
  -a, --agents <agents>      Comma-separated agents: security, logic, performance
  --pr                       Shortcut for GitHub PR Markdown format
  --exclude <patterns>       Comma-separated file patterns to ignore
  -v, --verbose              Show verbose debug information
  -h, --help                 Display help for command
```

---

## 🐙 GitHub Action Integration

Add automated multi-agent code reviews to any repository in 30 seconds.

### Quick Setup

Run in your repository root:
```bash
codeward init
```

This generates `.codewardrc.json` and `.github/workflows/codeward-review.yml`.

### Workflow Example

```yaml
name: Codeward Code Review & Security Audit

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  codeward-review:
    name: Multi-Agent AI Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full git history required for branch diffing

      - name: Run Codeward Review
        uses: codeward-ai/codeward@v1
        with:
          provider: 'openai'
          model: 'gpt-4o-mini'
          api-key: ${{ secrets.OPENAI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          base-branch: 'origin/${{ github.base_ref }}'
          fail-on: 'critical'
```

### GitHub Action Features
- **Sticky PR Comments**: Updates existing review comments as you push new commits, avoiding comment spam.
- **One-Click GitHub Suggestions**: Renders code fixes using ````suggestion blocks so maintainers can apply fixes directly in GitHub UI.
- **CI Quality Gate**: Automatically blocks PR merges by exiting with code `1` when critical security vulnerabilities are introduced.

---

## ⚙️ Configuration File (`.codewardrc.json`)

You can create a `.codewardrc.json` in your repository root to configure defaults:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "failOn": "critical",
  "agents": ["security", "logic", "performance"],
  "exclude": [
    "**/*.spec.ts",
    "**/*.test.ts",
    "docs/**",
    "migrations/**"
  ]
}
```

---

## 🔒 Built-in Ignore Rules

Codeward automatically filters out non-reviewable files before sending diffs to LLMs:
- **Lockfiles**: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `cargo.lock`, `poetry.lock`, etc.
- **Minified Bundles**: `*.min.js`, `*.min.css`, `*.bundle.js`, `*.chunk.js`.
- **Binaries & Media**: Images (`.png`, `.jpg`, `.svg`), fonts (`.woff2`), archives (`.zip`), compiled code (`.wasm`, `.pyc`).
- **Build Directories**: `dist/`, `build/`, `.next/`, `coverage/`.

---

## 🛠️ Local Development & Testing

```bash
# Clone the repository
git clone https://github.com/codeward-ai/codeward.git
cd codeward

# Install dependencies
npm install

# Run unit tests
npm test

# Build TypeScript
npm run build

# Run local CLI binary
./bin/codeward.js review --provider mock --staged
```

---

## 📄 License

MIT © [Codeward Contributors](https://github.com/codeward-ai/codeward)
