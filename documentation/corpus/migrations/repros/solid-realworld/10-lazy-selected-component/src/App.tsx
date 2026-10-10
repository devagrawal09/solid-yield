import { Errored, lazy, Loading } from "solid-js";
const Page = lazy(() => import("./Page"));

export function App() {
  return (
    <Errored fallback={<p>Could not load this page.</p>}>
      <Loading fallback="loading">
        <Page />
      </Loading>
    </Errored>
  );
}
