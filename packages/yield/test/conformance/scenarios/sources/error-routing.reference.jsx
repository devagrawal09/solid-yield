import { createMemo, createSignal, Errored } from "solid-js";
import { h, NotFound, Forbidden } from "conformance";
export let setMode, reset;
const parse = text => {
  throw new SyntaxError("cannot parse " + text);
};
function Value() {
  const [mode, sm] = h.signal("mode", "ok");
  setMode = sm;
  const value = createMemo(() => {
    const m = mode();
    h.run("value(" + m + ")");
    if (m === "typed") throw new NotFound("typed");
    if (m === "sync") parse("{");
    if (m === "recover") {
      try {
        throw new NotFound("inner");
      } catch (e) {
        return "recovered " + e.name;
      }
    }
    return m;
  });
  return (
    <Errored
      fallback={(err, r) => {
        reset = r;
        h.caught("boundary", err());
        return <p class="err">{err().name}</p>;
      }}
    >
      <p>{value()}</p>
    </Errored>
  );
}
// A handler created in Panel and bound in Child, under Child's Errored. Plain
// Solid routes no DOM handler's failure: the handwritten program catches the
// rejection where it binds the handler and throws it in a computation under
// that boundary, which is what the library's bind does (D-085).
function Child(props) {
  const [failure, setFailure] = createSignal();
  return (
    <Errored
      fallback={err => {
        h.caught("bind site", err());
        return <p class="bind-err">{err().name}</p>;
      }}
    >
      {(() => {
        const f = failure();
        if (f) throw f;
        return undefined;
      })()}
      <button class="save" onClick={() => props.save().catch(e => setFailure(() => e))}>
        save
      </button>
    </Errored>
  );
}
function Panel() {
  const save = async () => {
    h.run("save");
    throw new Forbidden("save");
  };
  return (
    <div class="panel">
      <Child save={save} />
    </div>
  );
}
export function App() {
  return (
    <>
      <Value />
      <Errored
        fallback={err => {
          h.caught("creation site", err());
          return <p class="creation-err">{err().name}</p>;
        }}
      >
        <Panel />
      </Errored>
    </>
  );
}
