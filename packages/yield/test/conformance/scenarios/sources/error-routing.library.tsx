import {
  component,
  $event,
  $memo,
  attempt,
  createContext,
  Errored,
  raise,
  view,
  type EventHandler,
  type Reset
} from "solid-yield";
import { h, NotFound, Forbidden } from "conformance";

// The driver writes through an event: a setter writes only when its receipt
// is delegated to inside a routine (D-021, D-028).
export let setMode: (m: string) => unknown;
export let reset: () => unknown;

/** The untyped failure, given a type by the attempt that catches it (D-034). */
class ParseFailure extends SyntaxError {
  readonly kind = "parse" as const;
}
const parse = (text: string): never => {
  throw new SyntaxError("cannot parse " + text);
};
const fail = (error: Error): never => {
  throw error;
};

const Value = component(function* Value() {
  const [mode, sm] = yield* h.$signal("mode", "ok");
  setMode = $event(function* (m: string) {
    yield* sm(m);
  });
  const value = yield* $memo(function* () {
    const m = yield* mode;
    h.run("value(" + m + ")");
    if (m === "typed") yield* raise(new NotFound("typed"));
    if (m === "sync")
      yield* attempt(
        () => parse("{"),
        cause => new ParseFailure((cause as Error).message)
      );
    // local recovery: an attempt that absorbs with a value (no try / catch, D-077)
    if (m === "recover")
      return yield* attempt(
        () => fail(new NotFound("inner")),
        e => "recovered " + (e as Error).name
      );
    return m;
  });
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            fallback: (err: () => NotFound | ParseFailure, r: Reset) => {
              reset = r;
              h.caught("boundary", err());
              return <p class="err">{err().name}</p>;
            },
            children: function* () {
              return <p>{yield* value}</p>;
            }
          })
        }
      </>
    );
  });
});

const Save = createContext<EventHandler<[], Forbidden, void, false, false>, "Save">();

/** Binds the handler it is given, under an Errored of its own: the bind site (D-085). */
const Child = component(function* Child() {
  // a context's value is read like a prop (D-098): read the handler, then bind it
  const save = yield* Save;
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            fallback: (err: () => Forbidden) => {
              h.caught("bind site", err());
              return <p class="bind-err">{err().name}</p>;
            },
            children: function* () {
              return (
                <button class="save" onClick={yield* yield* save}>
                  save
                </button>
              );
            }
          })
        }
      </>
    );
  });
});

/** Creates the handler, under the App's Errored: the creation site. */
const Panel = component(function* Panel() {
  const save = $event(function* () {
    h.run("save");
    yield* raise(new Forbidden("save"));
  });
  return view(function* () {
    // the wrapper element (in both sources): it once hid a library bug found
    // while porting this scenario — a provider tag at a view's root holding a
    // call-form Errored, under another Errored, kept that Errored's fallback
    // out of the DOM (D-085's note; fixed, test/provider-errored.spec.tsx)
    return (
      <div class="panel">
        <Save value={save}>{yield* Child()}</Save>
      </div>
    );
  });
});

export const App = component(function* App() {
  return view(function* () {
    return (
      <>
        {yield* Value()}
        {
          yield* Errored({
            fallback: (err: () => unknown) => {
              h.caught("creation site", err());
              return <p class="creation-err">{(err() as Error).name}</p>;
            },
            children: function* () {
              return <>{yield* Panel()}</>;
            }
          })
        }
      </>
    );
  });
});
