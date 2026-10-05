---
"solid-blocks": patch
---

A flow control's prop read on the server is its own, every time, not only while it is created: a server `For` over a pending source (a streamed memo under a `Loading`) reads `each` again when the view's template resolves its hole, inside the named view's run and with no observer, and development builds threw a false `READ_IN_VIEW` there (rendering-blocks' streamed `/stream`, `MemoList`). Every flow-control prop getter now runs as the flow control's read.
