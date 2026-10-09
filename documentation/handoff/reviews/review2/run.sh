#!/bin/zsh
# usage: run.sh casefile
cd /private/tmp/sy-review2-out/app
cp $1 src/index.tsx
echo "== CLI"; pnpm exec solid-yield check . 2>&1 | head -${2:-14}
echo "== ESLINT"; pnpm exec eslint . 2>&1 | grep -v '^$' | head -${2:-14}
echo "== BUILD"; pnpm exec vite build 2>&1 | grep -iE "error|✓ built" | head -3
