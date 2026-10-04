---
"@solidjs/blocks": patch
---

The example twins declare their pass-through props with type parameters (D-029). Room's `Transcript` forwards `messages` and its `CardBody` forwards `members` / `activity`; rendering's `Profile` forwards `info`. Each takes those props' color from its caller, as `Source<T, E, P>` with `<E, P extends boolean>`. A generic component's body is checked for every color, so it can forward only into a prop that accepts any color. The components that read those props (`Messages`, `MemberCount`, `ActivityLine`, `Facts`) are generic too. The per-twin count (102 props, 25 colored, 8 of them generic, no boundary added for typing) is recorded under D-023 in `DECISIONS.md`.
