#!/usr/bin/env bash
set -euo pipefail

checkout=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
node_bin=$(command -v node)
git_bin=$(command -v git)
if [[ "$node_bin" != /* || "$git_bin" != /* || ! -f "$checkout/dist/cli/index.js" ]]; then
  echo "Use Node.js and Git on your PATH, then build this checkout before running the demo." >&2
  exit 1
fi

fixture=$(mktemp -d)
trap 'rm -rf -- "$fixture"' EXIT
mkdir "$fixture/home" "$fixture/repo"
cd "$fixture/repo"

clean=(env -i PATH="$PATH" HOME="$fixture/home" LANG=C.UTF-8
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null)
"${clean[@]}" "$git_bin" init --quiet --template=
"${clean[@]}" "$git_bin" -c user.name='Local Codeward fixture' \
  -c user.email=fixture@example.invalid commit --quiet --allow-empty -m 'Fixture base'
printf 'export const message = "Hello from a local fixture";\n' > fixture.ts
"${clean[@]}" "$git_bin" add -- fixture.ts

printf '%s\n' 'Offline mock demo: findings are synthetic, not a security verdict.'
"${clean[@]}" CODEWARD_OFFLINE_SMOKE=1 "$node_bin" "$checkout/bin/codeward.js" review \
  --config "$checkout/config/action-mock.json" --staged --provider mock --fail-on none --format markdown
