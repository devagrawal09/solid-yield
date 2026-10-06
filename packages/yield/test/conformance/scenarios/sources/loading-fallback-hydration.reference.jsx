import { Loading } from "solid-js";
import { h } from "conformance";
export let setName;
export function App() {
  const [name, sn] = h.signal("name", "ada");
  setName = sn;
  return (
    <section>
      <Loading fallback={<p class="loading">loading</p>}>
        <p class="user">{name()}</p>
      </Loading>
    </section>
  );
}
