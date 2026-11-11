#!/usr/bin/env bash
set -euo pipefail

report_dir=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/codeward-report.XXXXXX")
report_path="$report_dir/report.md"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'report-path=%s\n' "$report_path" >> "$GITHUB_OUTPUT"
fi

args=(
  review
  --base "${INPUT_BASE_BRANCH:-origin/main}"
  --provider "${INPUT_PROVIDER:-openai}"
  --fail-on "${INPUT_FAIL_ON:-critical}"
  --agents "${INPUT_AGENTS:-security,logic,performance}"
  --pr
  --output "$report_path"
)

if [[ -n "${INPUT_MODEL:-}" ]]; then
  args+=(--model "$INPUT_MODEL")
fi

if [[ -n "${INPUT_API_URL:-}" ]]; then
  args+=(--api-url "$INPUT_API_URL")
fi

# Provider adapters read their API key from the provider-specific environment
# variable. Keep credentials out of argv and command logging.
exec codeward "${args[@]}"
