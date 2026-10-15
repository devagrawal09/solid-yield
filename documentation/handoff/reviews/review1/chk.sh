#!/bin/zsh
# usage: chk.sh  (runs cli, tsc, eslint on myapp)
cd /private/tmp/sy-review-out/myapp
echo "--- CLI"; pnpm exec solid-yield check . 2>&1 | head -${N:-12}
echo "--- TSC"; pnpm exec tsc --noEmit -p . 2>&1 | head -${N:-6}
echo "--- ESLINT"; pnpm exec eslint src 2>&1 | grep -v '^$' | head -${N:-10}
