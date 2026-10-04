import {
  $component,
  $event,
  $memo,
  $signal,
  Errored,
  For,
  Show,
  type Props,
  view
} from "solid-blocks";
import { Typeahead } from "./typeahead";
import { Checkout } from "./checkout";
import { createLog, type Log } from "./log";
import { createRuntime, RuntimeContext } from "./solid-effect";
import { SearchConfigLive } from "./api";

type Tab = "typeahead" | "checkout";

// The fiber log is block state the app's setup creates (Effect programs
// write it through `log()`); the panel reads its entries and clears it. The
// prop is read where it is used (D-042): its entries in a memo and holes,
// its `clear` event inside the event that calls it.
const LogPanel = $component(function* LogPanel(props: Props<{ log: Log }>) {
  const entries = props.log.entries;
  const newestFirst = yield* $memo(function* () {
    return [...(yield* entries)].reverse();
  });
  const clear = $event(function* () {
    yield* (yield* props.log.clear)();
  });
  return view(function* () {
    return (
      <aside class="log-panel">
        <header>
          <h2>Fiber events</h2>
          <button onClick={yield* clear}>Clear</button>
        </header>
        {
          yield* Show({
            when: function* () {
              return (yield* entries.length) > 0;
            },
            fallback: <p class="empty">Interact to see fiber lifecycle events.</p>,
            children: function* () {
              return (
                <ul>
                  {
                    yield* For({
                      each: newestFirst,
                      children: function* (entry) {
                        return view(function* () {
                          return (
                            <li class={`log-${yield* entry.kind}`}>
                              <span class="log-time">{yield* entry.time}</span>
                              <span class="log-kind">{yield* entry.kind}</span>
                              <span class="log-msg">{yield* entry.message}</span>
                            </li>
                          );
                        });
                      }
                    })
                  }
                </ul>
              );
            }
          })
        }
      </aside>
    );
  });
});

export const App = $component(function* App() {
  // Created before any child: the first Effects log as soon as they fork.
  const log = yield* createLog();
  const runtime = createRuntime(SearchConfigLive);
  const [tab, setTab] = yield* $signal<Tab>("typeahead");
  const showTypeahead = $event(function* () {
    yield* setTab("typeahead");
  });
  const showCheckout = $event(function* () {
    yield* setTab("checkout");
  });
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            fallback: (err, reset) => (
              <div class="error-box app-error">
                <p>Something went wrong: {String(err())}</p>
                <button onClick={reset}>Reset</button>
              </div>
            ),
            children: function* () {
              return (
                <RuntimeContext value={runtime}>
                  <div class="app">
                    <header class="app-header">
                      <h1>
                        Solid 2.0 <span class="times">×</span> Effect
                      </h1>
                      <p>
                        Two demos, one tiny integration (<code>src/solid-effect.ts</code>): Effects
                        as interruptible async sources on the read path, Effect sagas as transaction
                        steps on the action path, services provided through Solid context.
                      </p>
                      <nav class="tabs">
                        <button
                          class={{ selected: (yield* tab) === "typeahead" }}
                          onClick={yield* showTypeahead}
                        >
                          Typeahead <small>read path</small>
                        </button>
                        <button
                          class={{ selected: (yield* tab) === "checkout" }}
                          onClick={yield* showCheckout}
                        >
                          Checkout <small>action path</small>
                        </button>
                      </nav>
                    </header>
                    <main>
                      {
                        yield* Show({
                          when: function* () {
                            return (yield* tab) === "typeahead";
                          },
                          fallback: function* () {
                            return <>{yield* Checkout()}</>;
                          },
                          children: function* () {
                            return <>{yield* Typeahead()}</>;
                          }
                        })
                      }
                      {yield* LogPanel({ log: log })}
                    </main>
                  </div>
                </RuntimeContext>
              );
            }
          })
        }
      </>
    );
  });
});
