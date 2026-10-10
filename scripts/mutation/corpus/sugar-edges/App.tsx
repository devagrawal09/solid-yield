import {
  createEffect,
  createMemo,
  createSignal,
  Errored,
  For,
  Loading,
  onCleanup,
  refresh
} from "solid-js";
import { render, type JSX } from "@solidjs/web";
import { loadRows } from "./api";
import Badge from "./Badge";
import { FilterBar, FilterProvider, useFilters } from "./filters";
// D-119: a wrapper's own boundaries cover its children's colors.
function Panel(props: { title: string; children: JSX.Element }) {
  return (
    <section>
      <h2>{props.title.toLowerCase()}</h2>
      <Errored fallback={error => <p role="alert">{String(error())}</p>}>
        <Loading fallback="loading">{props.children}</Loading>
      </Errored>
    </section>
  );
}
// F-S40: a callback prop that writes, called from the child's event.
function Row(props: { title: string; score: number; reload: () => void }) {
  return (
    <li>
      {props.title} {props.score.toFixed(1)}
      <button onClick={() => props.reload()}>reload</button>
    </li>
  );
}
function Rows() {
  const filters = useFilters();
  const rows = createMemo(() => loadRows(filters.range()));
  const [minimum] = createSignal(0);
  // F-S46: array callbacks color their host.
  const shown = createMemo(() => rows().filter(row => row.score >= minimum()));
  return (
    <ul>
      {shown().map(row => (
        <Row title={row.title} score={row.score} reload={() => refresh(rows)} />
      ))}
    </ul>
  );
}
function Clock() {
  const [tick, setTick] = createSignal(0);
  // F-S42: the effect's returned cleanup runs before the next run.
  createEffect(
    () => tick(),
    value => {
      const id = setTimeout(() => setTick(value + 1), 1000);
      return () => clearTimeout(id);
    }
  );
  onCleanup(() => console.info("clock stopped"));
  return <p>{tick()}</p>;
}
function App() {
  return (
    <FilterProvider>
      <FilterBar />
      <Badge label="rows" />
      <Panel title="Rows">
        <Rows />
      </Panel>
      <Clock />
    </FilterProvider>
  );
}
render(() => <App />, document.body);
