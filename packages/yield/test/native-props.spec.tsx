import { createSignal, flush } from "solid-js";
import { component, render, view } from "solid-yield";
import { nativeC, type NativeProps } from "../src/native-props.js";
import { COMPONENT_MARK, READ, REFS } from "../src/runtime.js";

let dispose: (() => void) | undefined;
let root: HTMLDivElement;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
});

it("reads frozen foreign bags and absent optional props as paths", () => {
  const Page = nativeC(
    component(function* Page(
      props: NativeProps<{
        params: { id: string };
        location: { pathname: string };
        label?: string;
      }>
    ) {
      return view(function* () {
        return (
          <p>
            {yield* props.params.id}:{yield* props.location.pathname}:
            {(yield* props.label) ?? "missing"}
          </p>
        );
      });
    })
  );
  const props = Object.freeze({
    params: Object.freeze({ id: "inc-101" }),
    location: Object.freeze({ pathname: "/incidents/inc-101" })
  });
  dispose = render(() => Page(props), root);
  flush();
  expect(root.textContent).toBe("inc-101:/incidents/inc-101:missing");
});

it("does not evaluate foreign getters in setup and tracks nested reads", () => {
  const [pathname, setPathname] = createSignal("/first");
  let reads = 0;
  const props = Object.freeze({
    get location() {
      reads++;
      return { pathname: pathname() };
    }
  });
  const Page = nativeC(
    component(function* Page(props: NativeProps<{ location: { pathname: string } }>) {
      expect(reads).toBe(0);
      return view(function* () {
        return <p>{yield* props.location.pathname}</p>;
      });
    })
  );
  dispose = render(() => Page(props), root);
  flush();
  expect(root.textContent).toBe("/first");
  expect(reads).toBeGreaterThan(0);
  setPathname("/second");
  flush();
  expect(root.textContent).toBe("/second");
});

it.each([true, false])(
  "reads optional user symbol props as lazy paths (supplied: %s)",
  supplied => {
    const symbol = Symbol("user prop");
    const [value, setValue] = createSignal(7);
    let reads = 0;
    const raw = Object.freeze(
      supplied
        ? {
            get [symbol]() {
              reads++;
              return value();
            }
          }
        : {}
    );
    const Page = nativeC(
      component(function* (props: NativeProps<{ [symbol]?: number }>) {
        expect(reads).toBe(0);
        return view(function* () {
          return <p>{(yield* props[symbol]) ?? "missing"}</p>;
        });
      })
    );
    dispose = render(() => Page(raw), root);
    flush();
    expect(root.textContent).toBe(supplied ? "7" : "missing");
    setValue(8);
    flush();
    expect(root.textContent).toBe(supplied ? "8" : "missing");
  }
);

it.each([Object.preventExtensions, Object.seal, Object.freeze])(
  "rejects %s without corrupting foreign props",
  seal => {
    const Page = nativeC((props: object) => props);
    const props = Reflect.apply(Page, null, [{ value: 7 }]);
    expect(() => seal(props)).toThrow(TypeError);
    expect(Reflect.preventExtensions(props)).toBe(false);
    expect(Object.isExtensible(props)).toBe(true);
    expect(Object.keys(props)).toEqual(["value"]);
    expect(Object.getOwnPropertyDescriptor(props, "value")).toBeDefined();
    expect(typeof props.value[Symbol.iterator]).toBe("function");
  }
);

it("preserves call metadata, reflection and lazy protocol getters", () => {
  const symbol = REFS;
  let reads = 0;
  const raw = Object.freeze(
    Object.defineProperties(
      { visible: "value" },
      {
        hidden: { value: "hidden", enumerable: false },
        [symbol]: {
          get() {
            reads++;
            return "metadata";
          },
          enumerable: false
        }
      }
    )
  );
  const self = {};
  const routine = Object.assign(
    function Page(this: unknown, props: object, extra: unknown) {
      expect(this).toBe(self);
      expect(extra).toBe(42);
      return props;
    },
    { [COMPONENT_MARK]: true }
  );
  const Page = nativeC(routine);
  expect(Page.name).toBe(routine.name);
  expect(Reflect.get(Page, COMPONENT_MARK)).toBe(true);
  const props = Reflect.apply(Page, self, [raw, 42]);
  expect(props[READ]).toBeUndefined();
  expect(props[Symbol.iterator]).toBeUndefined();
  expect(Object.keys(props)).toEqual(["visible"]);
  expect(Reflect.ownKeys(props)).toEqual(Reflect.ownKeys(raw));
  expect(Object.getOwnPropertyDescriptor(props, "hidden")?.enumerable).toBe(false);
  expect(Object.getOwnPropertyDescriptor(props, "missing")).toBeUndefined();
  expect(Object.hasOwn(props, "missing")).toBe(false);
  expect("missing" in props).toBe(false);
  expect(Object.getOwnPropertyDescriptor(props, symbol)?.get).toBe(
    Object.getOwnPropertyDescriptor(raw, symbol)?.get
  );
  expect(reads).toBe(0);
  expect(props[symbol]).toBe("metadata");
  expect(reads).toBe(1);
});
