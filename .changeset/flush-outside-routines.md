---
"eslint-plugin-solid-yield": patch
---

From a second first-time-user review (F4). `no-foreign-reactive` no longer reports `import { flush } from "solid-js"` (or `@solidjs/signals`): `flush` is not reactive state, and the getting-started guide's tests import it to commit writes between two dispatched events, so the recommended config extended to test files reported the guide's own test. A use of `flush` inside a routine (at any depth of plain functions) is reported instead: a routine's writes commit when its transaction ends.
