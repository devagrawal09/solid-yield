// Codes match the existing lint/runtime catalog where the meanings overlap.
module.exports = Object.freeze({
  READ_IN_SETUP: "A setup creates; read this value in JSX, a memo, an effect, or an event.",
  WRITE_IN_REACTIVE:
    "A reactive computation cannot write; move this write to an event or effect phase.",
  JSX_IN_SETUP: "Build this JSX in the returned view, not in setup.",
  CREATE_OUTSIDE_SETUP: "Create reactive state in component setup, not in a JSX hole.",
  PENDING_ROOT: "The root may be pending; wrap the pending part in Loading.",
  NO_PROVIDER: "The root requires a context; provide it above the component that reads it.",
  SETTLED_PROP: "This prop is settled; pass a settled value or declare a pending source contract.",
  NATIVE_CALLBACK_FAILURE: "This foreign callback can fail; handle failures inside the callback.",
  FOREIGN_HANDOFF: "This component has unhandled colors at a Solid handoff.",
  GENERATED_TYPE: "Generated code does not satisfy the library contract."
});
