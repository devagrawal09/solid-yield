/**
 * The JSX flavor as written: `yield*` inside JSX. The transform's block rule
 * turns each into `perform(…)` in its own hole, so the view runs once.
 * Runs under the native compiler (default) and Babel (`JSX_COMPILER=babel`).
 */
import { flush } from "solid-js";
import {
  $component,
  $event,
  $memo,
  $signal,
  $store,
  attempt,
  For,
  Errored,
  Loading,
  render,
  Show,
  type Props,
  view
} from "solid-blocks";
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

it("measured case: runs once, suspends to Loading, updates text and class independently, keeps the input", async () => {
  let viewRuns = 0;
  let resolve!: (u: { name: string }) => void;
  let inc!: () => void;
  const Greeting = $component(function* () {
    const [n, setN] = yield* $signal(1);
    inc = () => write(() => setN(v => v + 1));
    const user = yield* $memo(function* () {
      return yield* attempt(() => new Promise<{ name: string }>(r => (resolve = r)), fail);
    });
    return view(function* () {
      viewRuns++;
      return (
        <div>
          <p class={{ big: (yield* n) > 3 }}>Hello {(yield* user).name}</p>
          <input />
        </div>
      );
    });
  });
  dispose = render(
    () =>
      Errored({
        fallback: "!",
        children: function* () {
          return (
            <>
              {
                yield* Loading({
                  fallback: function* () {
                    return <i>loading</i>;
                  },
                  children: function* () {
                    return <>{yield* Greeting()}</>;
                  }
                })
              }
            </>
          );
        }
      }),
    root
  );
  flush();
  expect(root.textContent).toBe("loading");
  resolve({ name: "Ada" });
  await settle();
  const p = root.querySelector("p")!;
  const input = root.querySelector("input")!;
  input.value = "typed";
  expect(p.textContent).toBe("Hello Ada");
  expect(p.className).toBe("");
  for (let i = 0; i < 3; i++) {
    inc();
    flush();
  }
  expect(p.className).toBe("big");
  expect(root.querySelector("p")).toBe(p);
  expect(root.querySelector("input")).toBe(input);
  expect(input.value).toBe("typed");
  expect(viewRuns).toBe(1);
});

it("props, stores, row blocks and hole blocks read with yield* in JSX", () => {
  let views = 0;
  const Item = $component(function* (props: Props<{ todo: { title: string; done: boolean } }>) {
    return view(function* () {
      views++;
      return <li class={{ done: yield* props.todo.done }}>{yield* props.todo.title}</li>;
    });
  });
  let toggle!: () => void;
  const App = $component(function* () {
    const [todos, setTodos] = yield* $store({
      list: [
        { title: "a", done: false },
        { title: "b", done: false }
      ]
    });
    toggle = () =>
      write(() =>
        setTodos(s => {
          s.list[1].done = true;
        })
      );
    const count = yield* $memo(function* () {
      return (yield* todos.list).filter(t => !t.done).length;
    });
    const [open, setOpen] = yield* $signal(true);
    const close = $event(function* () {
      yield* setOpen(false);
    });
    return view(function* () {
      return (
        <section>
          <ul>
            {
              yield* For({
                each: todos.list,
                children: function* (todo) {
                  return view(function* () {
                    return <>{yield* Item({ todo: todo })}</>;
                  });
                }
              })
            }
          </ul>
          {
            yield* For({
              each: todos.list,
              children: function* (todo, i) {
                const [seen] = yield* $signal("*");
                return view(function* () {
                  return (
                    <b>
                      {yield* i}
                      {yield* todo.title}
                      {yield* seen}
                    </b>
                  );
                });
              }
            })
          }
          <span>{yield* count}</span>
          {
            yield* Show({
              when: open,
              children: function* () {
                return <button onClick={yield* close}>close</button>;
              }
            })
          }
        </section>
      );
    });
  });
  dispose = render(App, root);
  flush();
  expect(root.querySelector("ul")!.textContent).toBe("ab");
  expect([...root.querySelectorAll("b")].map(b => b.textContent)).toEqual(["0a*", "1b*"]);
  expect(root.querySelector("span")!.textContent).toBe("2");
  const lis = [...root.querySelectorAll("li")];
  toggle();
  flush();
  expect(root.querySelector("span")!.textContent).toBe("1");
  expect(lis[1].className).toBe("done");
  expect([...root.querySelectorAll("li")]).toEqual(lis);
  expect(views).toBe(2);
  root.querySelector("button")!.click();
  flush();
  expect(root.querySelector("button")).toBe(null);
});
