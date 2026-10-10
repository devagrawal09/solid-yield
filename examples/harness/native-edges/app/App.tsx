import { createEffect, createMemo, createSignal, Errored, Loading, refresh } from "solid-js";
import type { JSX } from "@solidjs/web";
import { loadRows } from "./api";
import Badge from "./Badge";
import { FilterBar, FilterProvider, useFilters } from "./filters";
import { Status } from "./Status";
// A wrapper with its own boundaries (D-119) around a child that reads a
// context (F-S49): the child's pending, failure and requirement pass through it.
function Panel(props: { title: string; children: JSX.Element }) {
  return (
    <section>
      <h2>{props.title.toLowerCase()}</h2>
      <Errored fallback={error => <p role="alert">{String(error())}</p>}>
        <Loading fallback={<p class="loading">loading</p>}>{props.children}</Loading>
      </Errored>
    </section>
  );
}
// A callback prop that writes, called from the child's event (F-S40).
function Row(props: { title: string; score: number; reload: () => void }) {
  return (
    <li>
      {props.title} {props.score.toFixed(2)}
      <button class="reload" onClick={() => props.reload()}>
        reload
      </button>
    </li>
  );
}
// A user function given a callback: the callback's reads color its host (F-S47).
function describe(count: () => number): string {
  const n = count();
  return n === 1 ? "1 row" : `${n} rows`;
}
function Rows() {
  const filters = useFilters();
  const rows = createMemo(() => loadRows(filters.range()));
  const [minimum, setMinimum] = createSignal(0);
  // An array callback in a memo colors the memo (F-S46).
  const shown = createMemo(() => rows().filter(row => row.score >= minimum()));
  const summary = createMemo(() => describe(() => shown().length));
  return (
    <>
      <button class="raise" onClick={() => setMinimum(m => m + 1)}>
        at least {minimum()}
      </button>
      <p class="count">{summary()}</p>
      <ul>
        {shown().map(row => (
          <Row title={row.title} score={row.score} reload={() => refresh(rows)} />
        ))}
      </ul>
    </>
  );
}
// An effect whose returned cleanup clears its timer (F-S42).
function Clock() {
  const [tick, setTick] = createSignal(0);
  createEffect(
    () => tick(),
    value => {
      const id = setTimeout(() => setTick(value + 1), 1000);
      return () => clearTimeout(id);
    }
  );
  return <p class="clock">{tick()}</p>;
}
export function App() {
  return (
    <FilterProvider>
      <FilterBar />
      <Status />
      <Badge label="rows" />
      <Panel title="Rows">
        <Rows />
      </Panel>
      <Clock />
    </FilterProvider>
  );
}
