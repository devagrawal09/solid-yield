---
"solid-blocks": minor
"eslint-plugin-solid-blocks": patch
---

`$snapshot` is removed (D-042): every prop is a source, and a setup never reads, tracked or not. `$snapshot` took a value in a setup and silently froze what the parent believed was live. "Take the value once and ignore its updates" is a plain read where the host does not track: an `$event`, or an `$effect`'s effect phase (D-083; the `$untrack` op D-042 added is removed again, unused). The `Snapshot` op type is gone, and a component's coloring is its view's. The twins' 16 sites migrated with no untracked read: seeds became a `$signal` plus a `$memo` falling back to the prop, config moved into holes, sierpinski's setup-time leaf-or-branch choice became a flow control over a hole (with `{ lazy: true }` memos), and a callback prop is read inside the event that calls it.
