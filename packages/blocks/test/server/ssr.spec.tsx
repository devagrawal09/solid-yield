/**
 * Server rendering of blocks: the same components render to HTML, async
 * memos stream through Loading, row blocks and context work on the server.
 */
import { renderToString, renderToStream } from "@solidjs/web";

function stream(code: () => any): Promise<string> {
  return new Promise(resolve => {
    const chunks: string[] = [];
    renderToStream(code).pipe({
      write(chunk: string) {
        chunks.push(chunk);
      },
      end() {
        resolve(chunks.join(""));
      }
    });
  });
}
import {
  $component,
  $event,
  $memo,
  $signal,
  $store,
  attempt,
  createContext,
  For,
  Loading,
  perform,
  Show,
  type Props,
  view
} from "solid-blocks";
import { Failed } from "../failed.js";

const strip = (html: string) =>
  html
    .replace(/ _hk=[^ >]*/g, "")
    .replace(/ data-hk="[^"]*"/g, "")
    .replace(/<!--[^>]*-->/g, "");

describe("server rendering", () => {
  it("renders setup state, props, row blocks and context", () => {
    const Theme = createContext("light");
    const Item = $component(function* (props: Props<{ text: string }>) {
      const theme = yield* Theme;
      return function* () {
        return <li class={theme}>{perform(props.text)}</li>;
      };
    });
    const App = $component(function* () {
      const [items] = yield* $signal(["a", "b"]);
      const [store] = yield* $store({ title: "list" });
      const click = $event(function* () {});
      return function* () {
        return (
          <section onClick={yield* click}>
            <h1>{perform(store.title)}</h1>
            <ul>
              {
                yield* For({
                  each: items,
                  children: function* (t) {
                    return view(function* () {
                      return <>{yield* Item({ text: t })}</>;
                    });
                  }
                })
              }
            </ul>
            {
              yield* For({
                each: items,
                children: function* (t) {
                  const [n] = yield* $signal(1);
                  return function* () {
                    return (
                      <b>
                        {perform(t)}
                        {perform(n)}
                      </b>
                    );
                  };
                }
              })
            }
            {
              yield* Show({
                when: perform(items).length > 1,
                children: function* () {
                  return <i>many</i>;
                }
              })
            }
          </section>
        );
      };
    });
    const html = renderToString(() => <Theme value="dark">{App()}</Theme>);
    expect(strip(html)).toBe(
      '<section><h1>list</h1><ul><li class="dark">a</li><li class="dark">b</li></ul><b>a1</b><b>b1</b><i>many</i></section>'
    );
  });

  it("a view does not read on the server either: READ_IN_VIEW", () => {
    const ReadsInBody = $component(function* ReadsInBody() {
      const [n] = yield* $signal(1);
      return function* () {
        const v = yield* n;
        return <b>{v}</b>;
      };
    });
    expect(() => renderToString(() => ReadsInBody())).toThrow(/READ_IN_VIEW.*<ReadsInBody>/);
  });

  it("a flow control's own prop reads are not the named view's: no READ_IN_VIEW on the server (D-039)", () => {
    // Solid's server For / Show read `each` / `when` as they are created, with
    // no observer, while the holding view runs; an anonymous component was
    // never checked, a named one was (a false READ_IN_VIEW)
    const Named = $component(function* Named() {
      const [items] = yield* $signal(["a", "b"]);
      const [shown] = yield* $signal(true);
      return view(function* () {
        return (
          <ul>
            {
              yield* For({
                each: items,
                children: function* (t) {
                  return view(function* () {
                    return <li>{yield* t}</li>;
                  });
                }
              })
            }
            {
              yield* Show({
                when: shown,
                children: function* () {
                  return <b>{(yield* items).length}</b>;
                }
              })
            }
          </ul>
        );
      });
    });
    expect(strip(renderToString(() => Named({})))).toBe("<ul><li>a</li><li>b</li><b>2</b></ul>");
  });

  it("an async memo resolves on the server", async () => {
    const User = $component(function* () {
      const user = yield* $memo(function* () {
        return yield* attempt(
          () => Promise.resolve({ name: "Ada" }),
          e => new Failed(e)
        );
      });
      return function* () {
        return <h3>{perform(user).name}</h3>;
      };
    });
    const html = await stream(() =>
      Loading({
        fallback: <i>…</i>,
        children: function* () {
          return <>{yield* User()}</>;
        }
      })
    );
    expect(strip(html)).toContain("<h3>Ada</h3>");
  });
});
