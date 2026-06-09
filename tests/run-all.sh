#!/usr/bin/env bash
# 完整测试回归 —— bot 端 + GUI 端
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "━━━ bot 端 ━━━"
for f in "$ROOT"/tests/*.test.js; do
  echo ""
  echo "▶ $(basename "$f")"
  node "$f"
done

echo ""
echo "━━━ syntax check 所有 lib + index ━━━"
for f in "$ROOT"/lib/*.js "$ROOT"/telegram.js "$ROOT"/feishu.js; do
  [ -f "$f" ] || continue
  node --check "$f" && echo "  ✓ $(basename "$f")"
done

echo ""
echo "━━━ desktop 端 vitest ━━━"
cd "$ROOT/desktop"
npm test --silent

echo ""
echo "━━━ desktop typescript + vite build ━━━"
npm run build --silent | tail -5

echo ""
echo "━━━ ALL CHECKS PASSED ✓ ━━━"
