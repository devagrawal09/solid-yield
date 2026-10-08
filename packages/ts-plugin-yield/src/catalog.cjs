// Public codes stay stable; messages explain the next action in plain language.
const failureAdvice = host =>
  ["event", "effect"].includes(host)
    ? "Catch the failure inside this handler, or declare it in the handler's fails contract."
    : "Wrap this rendered work in Errored, or handle the failure with attempt.";
module.exports = Object.freeze({
  READ_IN_SETUP: "Move this read into JSX, a memo, an effect, or an event so it stays reactive.",
  WRITE_IN_REACTIVE:
    "Move this write into an event or effect; a memo or JSX read cannot write state.",
  JSX_IN_SETUP: "Return this JSX from the component's view.",
  CREATE_OUTSIDE_SETUP: "Create this state in the component body, before returning JSX.",
  PENDING_ROOT: "Wrap this read in Loading; it can suspend while waiting for data.",
  NO_PROVIDER: "Add a context provider above this component; this context has no default value.",
  SETTLED_PROP: "Pass a ready value, or allow a pending source in this prop's type.",
  NATIVE_CALLBACK_FAILURE: "Catch the failure inside this callback.",
  NATIVE_SETUP_FAILURE:
    "Move this throw into a memo or rendered work, or handle it with attempt; the component body only creates state. Here it cannot raise a failure.",
  SUGAR_CALLBACK: "Move this reactive read into JSX, a memo, an effect, or an event.",
  SUGAR_RETURN: "Return JSX on every component or row path.",
  SUGAR_ASYNC: "Keep this function synchronous and use attempt for async work.",
  NATIVE_EFFECT_PHASES:
    "Pass a tracked compute function and an untracked effect function to createEffect.",
  NATIVE_ASYNC_SETUP: "Move this async read into an event or memo.",
  FOREIGN_HANDOFF: failureAdvice("view"),
  GENERATED_TYPE:
    "Check this operation and the function containing it; the generated code cannot accept it.",
  failureAdvice
});
