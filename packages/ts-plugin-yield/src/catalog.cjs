// Public codes stay stable; messages explain the next action in plain language.
const failureAdvice = host =>
  ["event", "effect"].includes(host)
    ? "Catch the failure inside this handler, or declare it in the handler's fails contract."
    : "Wrap this rendered work in Errored, or handle the failure with attempt.";
module.exports = Object.freeze({
  CATCH_SWALLOWS:
    "This catch discards a failure without handling; return a fallback value, rethrow, or mark the absorption intentional with @yield-absorb.",
  EVENT_REJECTS:
    "This handler can fail and nothing catches it; wrap the body in try/catch, or declare the failure.",
  MODULE_STATE:
    "Create this state inside a component or a state factory; module state is shared by every render.",
  READ_IN_SETUP: "Move this read into JSX, a memo, an effect, or an event so it stays reactive.",
  WRITE_IN_REACTIVE:
    "Move this write into an event or effect; a memo or JSX read cannot write state.",
  JSX_IN_SETUP: "Return this JSX from the component's view.",
  CREATE_OUTSIDE_SETUP: "Create this state in the component body, before returning JSX.",
  PENDING_ROOT: "Wrap this read in Loading; it can suspend while waiting for data.",
  PENDING_IN_EFFECT:
    "Read this source in the effect's compute and pass the value; the effect phase runs once and does not wait for pending data.",
  NO_PROVIDER: "Add a context provider above this component; this context has no default value.",
  HELD_PROP:
    "This prop is held as a value: pass the value, or declare the prop reactive (Source<T>) to pass a live one.",
  REACTIVE_PROP:
    "This prop is reactive: pass a source or a computed read, or constant(v) for a fixed value.",
  HANDLER_PROP: "This prop is an event handler: pass an $event, not a source or a computed read.",
  HOLE_TYPED_PROP:
    "A prop typed as a function* with no parameters is read as a computed value: declare it Source<T>.",
  PROP_TYPE:
    "Declare this prop's type in the component's props; a bare `any` or `unknown` could hide a pending or failing value.",
  NATIVE_CALLBACK_FAILURE: "Catch the failure inside this callback.",
  NATIVE_SETUP_FAILURE:
    "Move this throw into a memo or rendered work, or handle it with attempt; the component body only creates state. Here it cannot raise a failure.",
  SUGAR_CALLBACK: "Move this reactive read into JSX, a memo, an effect, or an event.",
  SUGAR_RETURN: "Return JSX on every component or row path.",
  SUGAR_ASYNC: "Keep this function synchronous and use attempt for async work.",
  COLORED_CAPTURE:
    "Read this source in JSX or a memo and pass the value; plain code given it in setup reads it outside the check, where a pending or failing read cannot be handled.",
  NATIVE_EFFECT_PHASES:
    "Pass a tracked compute function and an untracked effect function to createEffect.",
  NATIVE_ASYNC_SETUP: "Move this async read into an event or memo.",
  FOREIGN_HANDOFF: failureAdvice("view"),
  GENERATED_TYPE:
    "Check this operation and the function containing it; the generated code cannot accept it.",
  failureAdvice
});
