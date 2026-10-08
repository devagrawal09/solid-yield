# Newcomer app fixture

`src/` and the original setup files are copied unchanged from
`/private/tmp/sy-review-out/myapp`. `variants/` contains the reviewer's supplied
variants unchanged, plus `for-call.tsx`, derived from their described
`item().name` mistake. `expectations.json` records the expected code, file and
line (null means silence). `review.test.cjs` runs all variants through the same
service as the editor and CLI.

The copied package.json records the historical link-based setup. Do not install
it as a workspace package. `scripts/fresh-install.mjs` writes a fresh manifest
with tarball/file dependencies and local overrides, then checks the copied app.
