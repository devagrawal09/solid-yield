/**
 * A component whose view's root element is iterable — `<form>` and `<select>`
 * have an indexed getter, so iterating one yields its controls — called in a
 * hole (`{yield* Editor()}`). The hole's `perform` took any object with a
 * `Symbol.iterator` for a routine operation and drove it: the form's first
 * control reached `drive` as an "operation", `[NOT_AN_OPERATION]`, and the
 * reactive system halted. A routine operation is recognised by what its
 * iterator gives — a generator — never by `Symbol.iterator` alone.
 */
import { flush } from "solid-js";
import { $event, $signal, component, perform, render, view } from "solid-yield";
import { holeOf } from "solid-yield/internal";

declare const __DEV__: boolean;
const devIt = __DEV__ ? it : it.skip;

// WebIDL gives an interface with an indexed getter `@@iterator` =
// `Array.prototype.values`; browsers and jsdom ≥ 30 have it on
// HTMLFormElement, the jsdom this package tests with (25) does not.
const formProto = HTMLFormElement.prototype as any;
const hadFormIterator = Object.prototype.hasOwnProperty.call(formProto, Symbol.iterator);
beforeAll(() => {
  if (!hadFormIterator) formProto[Symbol.iterator] = Array.prototype.values;
});
afterAll(() => {
  if (!hadFormIterator) delete formProto[Symbol.iterator];
});

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
});

function mount(App: () => any) {
  dispose = render(App as any, root);
  flush();
}

describe("a component whose view's root is iterable, called in a hole", () => {
  it("a <form> root renders, and its bound event runs", async () => {
    const Editor = component(function* Editor() {
      const [title, setTitle] = yield* $signal("draft");
      const save = $event(function* (e: SubmitEvent) {
        e.preventDefault();
        yield* setTitle("saved");
      });
      return view(function* () {
        return (
          <form onSubmit={yield* save}>
            <input name="title" value={yield* title} />
            <button type="submit">Save</button>
          </form>
        );
      });
    });
    const App = component(function* App() {
      return view(function* () {
        return <main>{yield* Editor()}</main>;
      });
    });
    mount(App);
    const form = root.querySelector("form")!;
    expect(form).not.toBeNull();
    expect(form.parentElement!.tagName).toBe("MAIN");
    expect(form.elements.length).toBe(2);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await Promise.resolve();
    await new Promise(r => setTimeout(r, 0));
    flush();
    expect(root.querySelector("input")!.value).toBe("saved");
  });

  it("a <select> root renders with its options", () => {
    const Picker = component(function* Picker() {
      const [theme] = yield* $signal("dark");
      return view(function* () {
        return (
          <select value={yield* theme}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        );
      });
    });
    const App = component(function* App() {
      return view(function* () {
        return <div>{yield* Picker()}</div>;
      });
    });
    mount(App);
    const select = root.querySelector("select")!;
    expect(select).not.toBeNull();
    expect(select.options.length).toBe(2);
  });

  it("a <ul> root (no indexed getter, not iterable) renders, as before", () => {
    const List = component(function* List() {
      return view(function* () {
        return (
          <ul>
            <li>a</li>
            <li>b</li>
          </ul>
        );
      });
    });
    const App = component(function* App() {
      return view(function* () {
        return <div>{yield* List()}</div>;
      });
    });
    mount(App);
    expect(root.querySelectorAll("li").length).toBe(2);
  });

  it("perform passes an iterable that is not an operation through as content", () => {
    const form = document.createElement("form");
    form.appendChild(document.createElement("input"));
    expect(typeof (form as any)[Symbol.iterator]).toBe("function");
    expect(perform(form as any)).toBe(form);
    const set = new Set([1, 2]);
    expect(perform(set as any)).toBe(set);
  });

  devIt("NOT_AN_OPERATION names what the routine yielded", () => {
    const input = document.createElement("input");
    const hole = holeOf(function* () {
      yield* new Set([input]) as any;
    });
    expect(() => perform(hole)).toThrow(/\[NOT_AN_OPERATION\].*It received: HTMLInputElement\./);
    const number = holeOf(function* () {
      yield* [1] as any;
    });
    expect(() => perform(number)).toThrow(/It received: number 1\./);
  });
});
