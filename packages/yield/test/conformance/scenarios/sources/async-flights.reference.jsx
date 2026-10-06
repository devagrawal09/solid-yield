import { createMemo, Loading, Errored } from "solid-js";
import { h } from "conformance";
export let setId;
export function App() {
  const [id, si] = h.signal("id", 1);
  setId = si;
  const user = createMemo(async () => {
    const i = id();
    h.owner("user memo");
    h.run("user(" + i + ")");
    h.where("before wait(" + i + ")");
    const v = await h.task("load", i);
    h.where("after wait(" + i + ")");
    return v;
  });
  return (
    <Errored
      fallback={err => {
        h.caught("boundary", err());
        return <p class="err">{err().name}</p>;
      }}
    >
      <Loading fallback={<p class="loading">loading</p>}>
        <p class="user">{user()}</p>
      </Loading>
    </Errored>
  );
}
