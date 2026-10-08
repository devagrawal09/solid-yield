import { action, createMemo, createOptimistic, createSignal, For, refresh, Show } from "solid-js";
import { acknowledge, getIncidents, type Incident } from "./api";
import { AckFailed } from "./errors";
import { useFilters, teamLabels } from "./filters";
import { Panel } from "./panel";

type Sort = "severity" | "title";
function IncidentRow(props: { row: Incident; reload: () => void }) {
  const [optimistic, setOptimistic] = createOptimistic(false);
  const [pending, setPending] = createOptimistic(false);
  const [failure, setFailure] = createSignal<AckFailed | null>(null);
  const ack = action(function* () {
    setOptimistic(true);
    setPending(true);
    try {
      yield acknowledge(props.row.id);
      setFailure(null);
      props.reload();
    } catch (cause) {
      if (!(cause instanceof AckFailed)) throw cause;
      setFailure(cause);
    }
  });
  const acknowledged = () => props.row.acknowledged || optimistic();
  return (
    <tr data-incident={props.row.id}>
      <td>
        <a href={`/incidents/${props.row.id}`}>{props.row.title}</a>
      </td>
      <td>{teamLabels[props.row.team]}</td>
      <td>P{props.row.severity}</td>
      <td>{props.row.ageHours}h</td>
      <td>
        <span class="ack-status">{acknowledged() ? "Acknowledged" : "Open"}</span>
        <button disabled={acknowledged() || pending()} onClick={ack}>
          {pending() ? "Saving…" : "Acknowledge"}
        </button>
        <Show when={failure()}>
          {error => (
            <p class="ack-error" role="alert">
              {error().kind}: {error().message}
            </p>
          )}
        </Show>
      </td>
    </tr>
  );
}

export function IncidentsPanel() {
  const filters = useFilters();
  const incidents = createMemo(() => getIncidents(filters.range()));
  const [sort, setSort] = createSignal<Sort>("severity");
  const [ascending, setAscending] = createSignal(true);
  const rows = createMemo(() => {
    const filtered = incidents().filter(
      row => filters.team() === "all" || row.team === filters.team()
    );
    return filtered.sort((a, b) => {
      const order = sort() === "title" ? a.title.localeCompare(b.title) : a.severity - b.severity;
      return (order || a.id.localeCompare(b.id)) * (ascending() ? 1 : -1);
    });
  });
  const changeSort = (column: Sort) => {
    if (sort() === column) setAscending(value => !value);
    else {
      setSort(column);
      setAscending(true);
    }
  };
  return (
    <Panel title="Recent incidents" name="incidents">
      <p>
        {teamLabels[filters.team()]} · {rows().length} incidents
      </p>
      <table>
        <caption>
          Sorted by {sort()}, {ascending() ? "ascending" : "descending"}
        </caption>
        <thead>
          <tr>
            <th
              aria-sort={sort() === "title" ? (ascending() ? "ascending" : "descending") : "none"}
            >
              <button onClick={() => changeSort("title")}>Title</button>
            </th>
            <th>Team</th>
            <th
              aria-sort={
                sort() === "severity" ? (ascending() ? "ascending" : "descending") : "none"
              }
            >
              <button onClick={() => changeSort("severity")}>Severity</button>
            </th>
            <th>Age</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <For
            each={rows()}
            fallback={
              <tr>
                <td colspan="5">No incidents in this range.</td>
              </tr>
            }
          >
            {row => <IncidentRow row={row} reload={() => refresh(incidents)} />}
          </For>
        </tbody>
      </table>
    </Panel>
  );
}
