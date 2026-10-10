import { createSignal } from "solid-js";
import { Pager } from "./Pager";

export function App() {
  const [page, setPage] = createSignal(0);
  return (
    <div>
      {page()} <Pager onSetPage={setPage} />
    </div>
  );
}
