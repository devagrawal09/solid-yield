import { createMemo, Loading } from "solid-js";
import { h } from "conformance";
export let setId;
export function App() {
  const [id, si] = h.signal("id", 1);
  setId = si;
  const user = createMemo(async () => {
    const i = id();
    h.run("user(" + i + ")");
    return await h.task("user" + i);
  });
  return (
    <section>
      <Loading fallback={<p class="loading">loading</p>}>
        <p class="user">{user()}</p>
      </Loading>
    </section>
  );
}
