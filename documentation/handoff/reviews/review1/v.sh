#!/bin/zsh
# usage: v.sh name  (reads /private/tmp/sy-review-out/variants/name.tsx -> src/App.tsx)
cp /private/tmp/sy-review-out/variants/$1.tsx /private/tmp/sy-review-out/myapp/src/App.tsx
cd /private/tmp/sy-review-out/myapp
echo "=== $1"; echo "--- CLI"; pnpm exec solid-yield check . 2>&1 | cut -c1-600 | head -8
echo "--- TSC"; pnpm exec tsc --noEmit -p . 2>&1 | cut -c1-300| head -4
