import { component, view, type Props, type PropsInput, type Source } from "solid-yield";
// F03: a broad plain-value arm must not swallow a colored Source.
// @ts-expect-error [PROP_TYPE] declare the prop's type
const Child = component(function* (p: Props<{ value: unknown }>) {
  return view(function* () {
    return <b>{String(yield* p.value)}</b>;
  });
});
declare const bad: Source<string, Error, true>;
// @ts-expect-error unknown input cannot hide a colored Source
const broad: PropsInput<{ value: unknown }> = { value: bad };
// @ts-expect-error any input cannot hide a colored Source
const anyInput: PropsInput<{ value: any }> = { value: bad };
// A deliberately colored broad value is safe.
type BroadSource = Props<{ value: Source<unknown> }>;
const Value = component(function* (p: Props<{ value: string }>) {
  return view(function* () {
    return <b>{yield* p.value}</b>;
  });
});
Value({ value: "ok" });
export type { BroadSource };
void [Child, broad, anyInput];
