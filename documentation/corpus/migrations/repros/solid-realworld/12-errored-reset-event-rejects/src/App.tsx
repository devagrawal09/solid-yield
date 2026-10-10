import { createMemo, Errored, Loading } from "solid-js";

class LoadError extends Error {}

async function load(): Promise<string> {
  throw new LoadError("down");
}

export function App() {
  const data = createMemo(() => load());
  return (
    <Errored
      fallback={(err, reset) => (
        <button onClick={() => reset()}>Retry</button>
      )}
    >
      <Loading fallback="loading">
        <p>{data()}</p>
      </Loading>
    </Errored>
  );
}
