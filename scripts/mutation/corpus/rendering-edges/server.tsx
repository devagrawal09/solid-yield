import { renderToString } from "@solidjs/web";
import { Errored, Loading, type ParentProps } from "solid-js";
import App from "./App";

// D-119: a ParentProps wrapper's children take what its callers pass.
function Shell(props: ParentProps<{ title: string }>) {
  return (
    <main>
      <h1>{props.title}</h1>
      {props.children}
    </main>
  );
}

// F-S53: a root tree inside a function; its typed parameter becomes a prop.
export function page(url: string) {
  return renderToString(() => (
    <Shell title={url}>
      <Errored fallback={error => <p>{String(error())}</p>}>
        <Loading fallback="…">
          <App url={url} />
        </Loading>
      </Errored>
    </Shell>
  ));
}
