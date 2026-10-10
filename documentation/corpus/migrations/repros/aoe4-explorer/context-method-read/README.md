# context-method-read

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/context-method-read`

Input: A context value whose `add()` reads `headings()` and writes `setHeadings(headings().concat(x))` (TableOfContents). This is also a real Solid 2 bug: reads return the committed value until flush, so several add() calls in one flush keep only the last heading (observed: 1 of 29 TOC entries).

Expected: A diagnostic about the stale read, or acceptance; either way the message should be about the read-after-write.

Actual: `Toc.tsx:11:19 [SUGAR_CALLBACK]` - refused as an unknown host. The checker neither accepts nor explains the stale-read bug; it fell out of the refusal only because the fix (a synchronous working copy) removes the read.

Control `NamedControl.tsx`: the same provider with the bug fixed (a synchronous working copy, `add` as a named function that
writes but never reads a signal). Actual: `NamedControl.tsx:13:41 [SUGAR_ESCAPE] Routine add is handed to an unknown
consumer; a plain callback cannot drive it.` - a write-only callback in a context value is still refused, so the shipped
TableOfContents keeps `add` out of the context value (a setter plus a plain registry object).
