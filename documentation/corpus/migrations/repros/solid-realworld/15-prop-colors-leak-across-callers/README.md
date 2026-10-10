A component whose prop receives a pending/failing value at one call site is treated as pending/failing at every call site, including a static call at the root.
Command: `ln -sfn /home/user/migrations/solid-realworld/node_modules node_modules; ./node_modules/.bin/solid-yield check .` (plain `tsc` passes).
`Link` is rendered twice: `<Link route="home" />` at the root (static props) and `<Link href={`@${name()}`} />` inside `Errored` + `Loading` in `Author`, where `name` is an async memo that rejects.
Expected: 0 errors. D-119 says "each call carries what it passes"; the colored call is covered by its own boundaries and the root call passes only a literal.
Actual:
`src/index.tsx:10:24 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: unknown.` (at Link's `href` hole) and
`src/index.tsx:27:8 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.` (at the static `<Link route="home" />`), both with related `The app is rendered here ... can suspend (pending); can fail with an unknown error`.
The errors stay when `<Author />` is not rendered at all (only declared); deleting the `Author` function makes them go away. In solid-realworld this put NavBar's static `<NavLink route="">Home</NavLink>` (outside every Errored) in error because ArticlePreview/Comments pass fetched usernames to NavLink's `href`. Workaround used: wrap NavBar in its own Errored.
