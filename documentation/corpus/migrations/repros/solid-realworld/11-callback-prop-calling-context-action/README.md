A callback prop that calls a context-provided action (or setter) is not hosted by the child's event that invokes it.
Command: `ln -sfn /home/user/migrations/solid-realworld/node_modules node_modules; ./node_modules/.bin/solid-yield check .` (plain `tsc` passes).
Child `Pager` calls `props.onSetPage(v)` in a click handler (inside a `For` row); the parent passes `onSetPage={(p) => { load(p); }}` where `load` is an `action` from context.
Expected: 0 errors (F-S40: a writing callback prop is hosted in the event that calls it; with a *local* signal setter in the parent callback this does pass).
Actual: `src/index.tsx:30:11 error TS2345: [WRITE_IN_REACTIVE] Move this write into an event or effect; a memo or JSX read cannot write state.` — a false positive; the call only ever runs in the child's click event.
Variant (`index-setter-variant.tsx.txt`: the parent callback calls the context *setter* `setPage(p)` instead): `src/index.tsx:30:11 error TS95000: [BABEL_PARSE_ERROR] ... Unexpected reserved word 'yield'.` (crash).
Variant: an expression-bodied callback calling a local action, `onSetPage={(p) => load(p)}`, also gives WRITE_IN_REACTIVE; the block-bodied `{ setPage(p); load(p); }` with local setter/action passes.
solid-realworld hit this for Home/Profile -> ArticleList (onSetPage), ArticleList -> ArticlePreview (onClickFavorite) and Comments -> Comment (onDelete); the children now call the context actions themselves.
