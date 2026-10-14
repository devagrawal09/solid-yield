import { Errored, Loading } from "solid-js";
import type { JSX } from "@solidjs/web";

export function Panel(props: { title: string; name: string; children: JSX.Element }) {
  return (
    <section class={`panel ${props.name}`} aria-label={props.title}>
      <h2>{props.title}</h2>
      <Errored
        fallback={(error, reset) => (
          <div role="alert">
            <p>
              Could not load {props.title.toLowerCase()}: {String(error())}
            </p>
            <button onClick={reset}>Try again</button>
          </div>
        )}
      >
        <Loading fallback={<p class="loading">Loading {props.title.toLowerCase()}…</p>}>
          {props.children}
        </Loading>
      </Errored>
    </section>
  );
}
