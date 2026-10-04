import { createMemo, Loading, Errored } from "solid-js";
import { h } from "conformance";
function User(props) {
  const user = createMemo(() => h.task("load", props.id));
  return <h3 class="user">{user().name}</h3>;
}
export function App() {
  return (
    <main>
      <Errored
        fallback={err => {
          h.caught("errored", err());
          return <p class="err">error</p>;
        }}
      >
        <Loading fallback={<p class="loading">loading</p>}>
          <User id="1" />
        </Loading>
      </Errored>
    </main>
  );
}
