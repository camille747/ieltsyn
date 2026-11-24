#!/bin/zsh
set -eu
cd "$(dirname "$0")"
export PATH="$PWD/.tools/node-v24.22.0-darwin-arm64/bin:$PATH"
export LC_ALL=en_US.UTF-8
export NODE_USE_ENV_PROXY=1
export electron_config_cache="$PWD/.tools/electron-cache"
if ! command -v npm >/dev/null 2>&1; then
  echo "需要 Node.js 24.22 或更高的 24.x 版本，请先阅读 README.md。"
  read -r "?按回车退出"
  exit 1
fi
if [[ ! -x node_modules/.bin/vite ]]; then
  npm ci
fi
npm run "${1:-dev}"
