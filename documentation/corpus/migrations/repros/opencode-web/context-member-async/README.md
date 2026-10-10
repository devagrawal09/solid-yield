# Reading a context-provided signal inside an async event handler is refused

Command: `./node_modules/.bin/solid-yield check .`

Expected: accepted. The same handler over a component-local signal is accepted (see prop-method-await/SignalHeld.tsx).

Actual: `App.tsx:18:20 [SUGAR_HOST] Reactive operations in async functions or methods are unsupported.` at `api()`.
