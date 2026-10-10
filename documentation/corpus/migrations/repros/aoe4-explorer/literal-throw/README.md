# literal-throw

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/literal-throw`

Input: `throw "Response not in expected format"` inside a try whose catch returns `[]` (query/content.ts).

Expected: Known: NATIVE_THROW refuses literal primitive throws (sugar-design.md 'Failure inference'). Included for the count only.

Actual: `Content.tsx:6:20 [NATIVE_THROW] Throw an Error object ...` even though the throw is caught two lines later.
