import { createSignal, createMemo, Errored } from "solid-js";
import { h } from "conformance";
function Saver() {
  const [status, ss] = h.signal("status", "idle");
  const [failure, setFailure] = createSignal(undefined);
  const guard = createMemo(() => {
    const f = failure();
    if (f) throw f;
  });
  const save = async () => {
    h.run("save");
    ss("saving");
    try {
      const answer = await h.task("save");
      ss(answer);
    } catch (e) {
      setFailure(() => e);
    }
  };
  return (
    <button class="save" onClick={save}>
      {(guard(), status())}
    </button>
  );
}
export function App() {
  return (
    <Errored
      fallback={err => {
        h.caught("boundary", err());
        return <p class="err">{err().name}</p>;
      }}
    >
      <Saver />
    </Errored>
  );
}
