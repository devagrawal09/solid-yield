---
"solid-blocks": patch
---

On the server, a view that is a function (a flow control's, a lazy component's) given to a hole is retried as itself when it is pending, not by re-running the hole that called it. Solid's server hole calls a function it returns inside the hole, so a pending read in a lazy page made the whole hole the retry unit: the retry called the component again, set it up a second time and re-ran its memos. With chained async memos the second set never settled: a memo spun in microtasks on the serialization slot its predecessor had resolved, starving every timer, and the stream never ended (rendering-blocks' streamed `/profile`). `perform` now hands such a view back to Solid's server renderer as a one-element array, which Solid resolves, and retries, as its own node. Client rendering is unchanged, and settled server output is byte-identical.
