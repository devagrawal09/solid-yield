import { createContext, constant } from "solid-yield";
import { h } from "solid-yield/h";
const C = createContext<unknown, "C">(undefined, { name: "C" });
// F05: Exclude<unknown, undefined> is still unknown.
C.provide({
  // @ts-expect-error [PROVIDE_UNDEFINED] undefined is not an installed value
  value: undefined,
  children: function* () {
    return "ok";
  }
});
// @ts-expect-error h uses the same branded check
h(C.provide, { value: undefined }, "ok");
C.provide({
  value: null,
  children: function* () {
    return "ok";
  }
});
C.provide({
  value: constant(undefined),
  children: function* () {
    return "ok";
  }
});
h(C.provide, { value: constant(undefined) }, "ok");
