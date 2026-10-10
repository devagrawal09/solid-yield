import { render } from "@solidjs/web";
import { createMemo, Errored, Loading } from "solid-js";
import type { ParentProps } from "solid-js";

async function loadName(): Promise<string> {
  return "alice";
}

function Link(props: ParentProps<{ href?: string }>) {
  return <a href={`#/${props.href}`}>{props.children}</a>;
}

function Meta(props: { name?: string }) {
  return <Link href={`@${props.name}`}>{props.name}</Link>;
}

function App() {
  const name = createMemo(() => loadName());
  return (
    <Errored fallback="failed">
      <Loading fallback="...">
        <Meta name={name()} />
      </Loading>
    </Errored>
  );
}
render(() => <App />, document.body);
