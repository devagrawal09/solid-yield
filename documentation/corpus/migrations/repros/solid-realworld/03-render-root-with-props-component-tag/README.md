Rendering an imported component that takes props directly at the root is refused.
Command: `ln -sfn /home/user/migrations/solid-realworld/node_modules node_modules; ./node_modules/.bin/solid-yield check .`
Expected: 0 errors (valid Solid 2; `render(() => <App />)` with a prop-less App passes). Actual: `src/index.tsx:4:15 error TS2786: [COMPONENT_TAG] call a yield component in a hole: {yield* Comp(props)}` — an explicit-dialect message that names generator syntax the native author never wrote. Wrapping it in a local prop-less `App` makes it pass.
