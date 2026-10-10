A component whose props are typed `ParentProps<{...}>` is not widened for pending/failing prop values (D-119), while the same props written out with `children?: JSX.Element` are.
Command: `ln -sfn /home/user/migrations/solid-realworld/node_modules node_modules; ./node_modules/.bin/solid-yield check .` (plain `tsc` passes).
`Meta` forwards a pending memo value (`name()`, under Loading + Errored) into `Link`'s `href`.
Expected: 0 errors (D-119: "a prop forwarded to another component widens that one too").
Actual: `src/index.tsx:14:16 error TS2322: [SETTLED_PROP] Pass a ready value, or allow a pending source in this prop's type.` and `src/index.tsx:13:10 error TS2322: [generated] [GENERATED_TYPE] ...`. With `explicit-children-variant.tsx.txt` (copied over `src/index.tsx`): 0 errors. The SETTLED_PROP advice ("allow a pending source in this prop's type") is not something a native author can write. solid-realworld's NavLink had to drop `ParentProps`.
