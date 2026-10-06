/**
 * The no-JSX flavor (`h`), no build step: holes are sources and
 * bare `function*`s, the view runs once, async suspends and
 * resolves, updates are fine-grained, and the input keeps its text.
 */
import { flush } from "solid-js";
import {
  component,
  $effect,
  $event,
  $memo,
  $signal,
  $store,
  attempt,
  createContext,
  For,
  Errored,
  Loading,
  readStore,
  render,
  raise,
  Show,
  type EventHandler,
  type Props,
  view
} from "solid-yield";
import { h } from "solid-yield/h";
import { toFailed } from "./failed.js";
import { write } from "./write.js";

const tick = () => new Promise<void>(r => setTimeout(r, 0));

const fail = toFailed;

async function settle() {
  for (let i = 0; i < 3; i++) {
    await tick();
    flush();
  }
}

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  root.remove();
});

describe("h", () => {
  it("measured case: runs once, suspends, fine-grained, input kept", async () => {
    let viewRuns = 0;
    let resolve!: (u: { name: string }) => void;
    let inc!: () => void;
    const Greeting = component(function* () {
      const [n, setN] = yield* $signal(1);
      inc = () => write(() => setN(v => v + 1));
      const user = yield* $memo(function* () {
        return yield* attempt(() => new Promise<{ name: string }>(r => (resolve = r)), fail);
      });
      // a bare function* is a hole (here an attribute value's)
      const cls = function* () {
        return (yield* n) > 3 ? "big" : "";
      };
      return view(function* () {
        viewRuns++;
        return h(
          "div",
          h(
            "p",
            { class: cls },
            "Hello ",
            function* () {
              return (yield* user).name;
            },
            " ",
            n
          ),
          h("input")
        );
      });
    });
    dispose = render(
      () =>
        h(
          "div",
          Errored({
            fallback: "failed",
            children: () => Loading({ fallback: "loading", children: () => Greeting() })
          })
        ),
      root
    );
    flush();
    expect(root.textContent!.trim()).toBe("loading");
    resolve({ name: "Ada" });
    await settle();
    const p = root.querySelector("p")!;
    const input = root.querySelector("input")!;
    input.value = "typed";
    expect(p.textContent!.trim()).toBe("Hello Ada 1");
    for (let i = 0; i < 3; i++) {
      inc();
      flush();
    }
    expect(p.textContent!.trim()).toBe("Hello Ada 4");
    expect(p.className).toBe("big");
    expect(root.querySelector("p")).toBe(p);
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("typed");
    expect(viewRuns).toBe(1);
  });

  it("row routines, store paths, events", () => {
    let rowSetups = 0;
    const App = component(function* () {
      const [store, setStore] = yield* $store({ items: ["a", "b"] });
      const [show, setShow] = yield* $signal(true);
      const add = $event(function* () {
        yield* setStore(s => {
          s.items.push("c");
        });
      });
      const hide = $event(function* () {
        yield* setShow(false);
      });
      const row = function* (item: any) {
        rowSetups++;
        const [n, setN] = yield* $signal(0);
        const bump = $event(function* () {
          yield* setN(v => v + 1);
        });
        return view(function* () {
          return h("li", { onClick: bump }, item, ":", n);
        });
      };
      return view(function* () {
        return h(
          "div",
          h("button", { id: "add", onClick: add }, "add"),
          h("ul", For({ each: store.items, children: row })),
          Show({ when: show, children: h("button", { id: "hide", onClick: hide }, "hide") })
        );
      });
    });
    dispose = render(App as any, root);
    flush();
    const lis = () => [...root.querySelectorAll("li")];
    expect(lis().map(l => l.textContent)).toEqual(["a:0", "b:0"]);
    lis()[1].click();
    flush();
    expect(lis().map(l => l.textContent)).toEqual(["a:0", "b:1"]);
    (root.querySelector("#add") as HTMLButtonElement).click();
    flush();
    expect(lis().map(l => l.textContent)).toEqual(["a:0", "b:1", "c:0"]);
    expect(rowSetups).toBe(3);
    (root.querySelector("#hide") as HTMLButtonElement).click();
    flush();
    expect(root.querySelector("#hide")).toBe(null);
  });
});

describe("h: a context's provider (D-098)", () => {
  it("h(Ctx.provide, { value }, ...children) gives the value to the components in its children", () => {
    const Name = createContext<string, "Name">();
    const Reader = component(function* Reader() {
      const name = yield* Name;
      return view(function* () {
        return h("b", name);
      });
    });
    let set!: (v: string) => void;
    const App = component(function* App() {
      const [n, setN] = yield* $signal("a");
      set = v => write(() => setN(v));
      return view(function* () {
        // h(Reader, {}): created inside the provider (a direct call runs with the view)
        return h(Name.provide, { value: n }, h("p", h(Reader, {})));
      });
    });
    dispose = render(App, root);
    flush();
    expect(root.innerHTML).toBe("<p><b>a</b></p>");
    set("b");
    flush();
    expect(root.innerHTML).toBe("<p><b>b</b></p>");
  });
});

describe("h argument shapes", () => {
  it("a bare function* is a hole: a child, an attribute value, a flow control's source", () => {
    let set!: (v: number) => void;
    let holeRuns = 0;
    const App = component(function* () {
      const [n, setN] = yield* $signal(1);
      set = v => write(() => setN(v));
      return view(function* () {
        return h(
          "p",
          {
            title: function* () {
              return `n is ${yield* n}`;
            }
          },
          function* () {
            holeRuns++;
            return (yield* n) * 2;
          },
          Show({
            when: function* () {
              return (yield* n) > 1;
            },
            children: h("b", "big")
          })
        );
      });
    });
    dispose = render(App, root);
    flush();
    const p = root.querySelector("p")!;
    expect(p.title).toBe("n is 1");
    expect(p.textContent).toBe("2");
    set(2);
    flush();
    expect(p.title).toBe("n is 2");
    expect(p.textContent).toBe("4big");
    expect(root.querySelector("p")).toBe(p);
    expect(holeRuns).toBe(2);
  });

  it("a path or a selection as the second argument is a child, not the props", () => {
    const App = component(function* () {
      const [store, setStore] = yield* $store({ user: { name: "Ada" }, tags: ["a", "b"] });
      const rename = $event(function* () {
        yield* setStore(s => {
          s.user.name = "Grace";
        });
      });
      return view(function* () {
        return h(
          "p",
          h("b", store.user.name),
          h(
            "i",
            readStore(store, s => s.tags.join(","))
          ),
          h("button", { onClick: rename }, "rename")
        );
      });
    });
    dispose = render(App as any, root);
    flush();
    expect(root.querySelector("b")!.textContent).toBe("Ada");
    expect(root.querySelector("i")!.textContent).toBe("a,b");
    root.querySelector("button")!.click();
    flush();
    expect(root.querySelector("b")!.textContent).toBe("Grace");
  });

  it("h([a, b]) is a fragment", () => {
    const App = component(function* () {
      const [count, setCount] = yield* $signal(1);
      const inc = $event(function* () {
        yield* setCount(c => c + 1);
      });
      return view(function* () {
        return h([h("b", count), h("button", { onClick: inc }, "+")]);
      });
    });
    dispose = render(App, root);
    flush();
    expect(root.innerHTML).toBe("<b>1</b><button>+</button>");
    root.querySelector("button")!.click();
    flush();
    expect(root.innerHTML).toBe("<b>2</b><button>+</button>");
  });

  it("a prop holding an array or a store is passed as it is", () => {
    let seen: unknown;
    const Child = component(function* (props: Props<{ list: string[] }>) {
      yield* $effect(
        function* () {},
        function* () {
          seen = yield* props.list;
        }
      );
      return view(function* () {
        return h("span", "ok");
      });
    });
    const list = ["x", "y"];
    dispose = render(() => h(Child, { list }) as any, root);
    flush();
    expect(seen).toBe(list);
  });
});

describe("h binds an event attribute where its output is materialized (D-085)", () => {
  class SaveError extends Error {
    readonly kind = "save" as const;
  }
  it("created in Parent, bound in Child under Child's Errored: that Errored shows it, not the one above both", async () => {
    let save!: EventHandler<[], SaveError, void, false, false>;
    const Child = component(function* Child() {
      const bound = save;
      return view(function* () {
        return h("button", { onClick: bound }, "save");
      });
    });
    const Parent = component(function* Parent() {
      save = $event(function* () {
        yield* raise(new SaveError("save failed"));
      });
      return view(function* () {
        return h(
          "section",
          Errored({
            fallback: (e: () => SaveError) => h("p", "child's: ", e().message),
            children: () => Child()
          })
        );
      });
    });
    const outer: unknown[] = [];
    dispose = render(
      () =>
        Errored({
          fallback: (e: () => unknown) => (outer.push(e()), h("p", "outer")),
          children: () => Parent()
        }),
      root
    );
    flush();
    root.querySelector("button")!.click();
    await settle();
    expect(outer).toEqual([]);
    expect(root.textContent).toBe("child's: save failed");
  });
});
