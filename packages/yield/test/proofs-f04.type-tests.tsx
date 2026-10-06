import {
  createContext,
  component,
  view,
  render,
  type RequiredContext,
  type YieldContext
} from "solid-yield";
declare const el: HTMLElement;
// F04: undefined is never a default, even if the declared value type admits it.
// @ts-expect-error no default needs a runtime context name
createContext<string | undefined>(undefined);
// @ts-expect-error unknown cannot conceal an undefined default
createContext<unknown>(undefined);
const C = createContext<string | undefined, "C">(undefined, { name: "C" });
const required: RequiredContext<string | undefined, "C"> = C;
const Reader = component(function* () {
  const c = yield* C;
  return view(function* () {
    return <b>{yield* c}</b>;
  });
});
// @ts-expect-error the reader requires C
render(Reader, el);
const present: YieldContext<string | undefined> = createContext<string | undefined>("present");
const broad: YieldContext<unknown> = createContext<unknown>(null);
void [required, present, broad];
