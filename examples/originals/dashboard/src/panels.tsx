import { createEffect, createMemo, createSignal, For, refresh } from "solid-js";
import { getSummary, getTeam } from "./api";
import { useFilters, rangeLabels, teamLabels } from "./filters";
import { Panel } from "./panel";

export const REFRESH_MS = 30_000;
export const NOTES_KEY = "operations-desk-notes";
const number = new Intl.NumberFormat("en-US");

export function SummaryPanel() {
  const filters = useFilters();
  const summary = createMemo(() => getSummary(filters.range()));
  const totals = createMemo(() => {
    const rows = summary().teams.filter(
      row => filters.team() === "all" || row.team === filters.team()
    );
    const requests = rows.reduce((sum, row) => sum + row.requests, 0);
    const errors = rows.reduce((sum, row) => sum + row.errors, 0);
    const previous = rows.reduce((sum, row) => sum + row.previousRequests, 0);
    const weightedLatency = rows.reduce((sum, row) => sum + row.latency * row.requests, 0);
    return {
      requests,
      success: requests ? (1 - errors / requests) * 100 : 100,
      latency: requests ? weightedLatency / requests : 0,
      growth: previous ? ((requests - previous) / previous) * 100 : 0
    };
  });
  createEffect(
    () => {},
    () => {
      const timer = setInterval(() => refresh(summary), REFRESH_MS);
      return () => clearInterval(timer);
    }
  );
  return (
    <Panel title="Service summary" name="summary">
      <p>
        {rangeLabels[filters.range()]} · {teamLabels[filters.team()]}
      </p>
      <dl class="kpis">
        <div>
          <dt>Requests</dt>
          <dd data-kpi="requests">{number.format(totals().requests)}</dd>
        </div>
        <div>
          <dt>Success rate</dt>
          <dd data-kpi="success">{totals().success.toFixed(2)}%</dd>
        </div>
        <div>
          <dt>Mean latency</dt>
          <dd data-kpi="latency">{totals().latency.toFixed(0)} ms</dd>
        </div>
        <div>
          <dt>Request growth</dt>
          <dd data-kpi="growth">
            {totals().growth >= 0 ? "+" : ""}
            {totals().growth.toFixed(1)}%
          </dd>
        </div>
      </dl>
      <p class="updated" data-updated={summary().updatedAt}>
        Updated {new Date(summary().updatedAt).toISOString().slice(11, 19)} UTC · refreshes every 30
        seconds
      </p>
    </Panel>
  );
}

export function TeamPanel() {
  const filters = useFilters();
  const members = createMemo(() => getTeam());
  const visible = createMemo(() =>
    members().filter(member => filters.team() === "all" || member.team === filters.team())
  );
  return (
    <Panel title="Team roster" name="roster">
      <p>
        {teamLabels[filters.team()]} · staffing for {rangeLabels[filters.range()].toLowerCase()}
      </p>
      <ul>
        <For each={visible()}>
          {member => (
            <li>
              <strong>{member.name}</strong> · {member.role}
              <span class="on-call">{member.onCall ? " · On call" : " · Off duty"}</span>
            </li>
          )}
        </For>
      </ul>
      <p>
        {visible().length} team members · {visible().filter(member => member.onCall).length} on call
      </p>
    </Panel>
  );
}

export function NotesPanel() {
  const filters = useFilters();
  const [notes, setNotes] = createSignal("");
  const [ready, setReady] = createSignal(false);
  const [storageError, setStorageError] = createSignal("");
  createEffect(
    () => {},
    () => {
      try {
        setNotes(localStorage.getItem(NOTES_KEY) ?? "");
      } catch {
        setStorageError("Browser storage is unavailable; notes last for this visit.");
      }
      setReady(true);
    }
  );
  createEffect(
    () => ({ text: notes(), ready: ready() }),
    value => {
      if (!value.ready) return;
      try {
        localStorage.setItem(NOTES_KEY, value.text);
      } catch {
        setStorageError("Could not save notes in this browser.");
      }
    }
  );
  return (
    <section class="panel notes" aria-label="Shift notes">
      <h2>Shift notes</h2>
      <p>
        {teamLabels[filters.team()]} · {rangeLabels[filters.range()]} · private to this browser
      </p>
      <textarea
        aria-label="Shift notes"
        rows="4"
        value={notes()}
        onInput={e => setNotes(e.currentTarget.value)}
        placeholder="Leave a note for your next shift"
      />
      <p class="note-count">{notes().length} characters</p>
      <p role="status">{storageError() || "Saved in this browser"}</p>
    </section>
  );
}
