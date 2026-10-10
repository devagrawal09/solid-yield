import { render } from "@solidjs/web";
import { createMemo, Errored, Loading } from "solid-js";

class LoadError extends Error {}
async function loadName(): Promise<string> {
  throw new LoadError("down");
}

function Link(props: { href?: string; route?: string }) {
  return <a href={`#/${props.href || props.route}`}>link</a>;
}

function Author() {
  const name = createMemo(() => loadName());
  return (
    <Errored fallback={<p>could not load</p>}>
      <Loading fallback="...">
        <Link href={`@${name()}`} />
      </Loading>
    </Errored>
  );
}

function App() {
  return (
    <>
      <Link route="home" />
      <Author />
    </>
  );
}
render(() => <App />, document.body);
