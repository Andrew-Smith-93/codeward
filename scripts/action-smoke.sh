#!/usr/bin/env bash
set -euo pipefail

: "${CODEWARD_ACTION_PATH:?Codeward action path is required}"
base=${CODEWARD_BASE_REF:-origin/main}
if [[ "$base" != origin/* ]] || ! git check-ref-format "refs/remotes/$base"; then
  echo "Codeward requires an origin remote-tracking branch." >&2
  exit 1
fi
if ! git show-ref --verify --quiet "refs/remotes/$base"; then
  echo "Codeward base branch is not available locally; check out with full history first." >&2
  exit 1
fi

node_bin=$(command -v node)
if [[ "$node_bin" != /* ]]; then
  echo "Codeward requires an absolute Node.js executable." >&2
  exit 1
fi

# Do not pass the runner's credentials, provider variables, or GitHub event context.
# Use the packaged config and skip checkout-provided dotenv/custom agents.
echo "Codeward offline smoke check (mock output is not a security audit)."
exec env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 CODEWARD_OFFLINE_SMOKE=1 \
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
  "$node_bin" "$CODEWARD_ACTION_PATH/bin/codeward.js" review \
  --base "refs/remotes/$base" --config "$CODEWARD_ACTION_PATH/config/action-mock.json" \
  --provider mock --fail-on none --format markdown
