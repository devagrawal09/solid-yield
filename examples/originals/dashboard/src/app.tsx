import { createRouter, defineRoute, defineRoutes, type RouteSectionProps } from "@solidjs/router";
import { createMemo, Errored, Loading } from "solid-js";
import { getIncident, type Incident } from "./api";
import { NotFound } from "./errors";
import { FilterBar, FilterProvider, useFilters, teamLabels, rangeLabels } from "./filters";
import { SeriesPanel } from "./chart";
import { IncidentsPanel } from "./incidents";
import { NotesPanel, SummaryPanel, TeamPanel } from "./panels";
import "./app.css";

function Overview() {
  return (
    <main class="overview">
      <SummaryPanel />
      <SeriesPanel />
      <IncidentsPanel />
      <TeamPanel />
      <NotesPanel />
    </main>
  );
}

function IncidentBody(props: { incident: Incident }) {
  const filters = useFilters();
  return (
    <article class="panel detail">
      <p>
        {teamLabels[filters.team()]} · {rangeLabels[filters.range()]}
      </p>
      <h2>{props.incident.title}</h2>
      <p>{props.incident.description}</p>
      <dl>
        <dt>Incident</dt>
        <dd>{props.incident.id}</dd>
        <dt>Owner</dt>
        <dd>{teamLabels[props.incident.team]}</dd>
        <dt>Severity</dt>
        <dd>P{props.incident.severity}</dd>
        <dt>Status</dt>
        <dd>{props.incident.acknowledged ? "Acknowledged" : "Open"}</dd>
      </dl>
      <a href="/overview">Back to overview</a>
      <a href="/incidents/missing">Next incident</a>
    </article>
  );
}

function IncidentDetail(props: RouteSectionProps) {
  const incident = createMemo(() => getIncident(props.params.id!));
  return (
    <main class="detail-route">
      <Errored
        fallback={(error, reset) => (
          <section class="panel route-error" role="alert">
            <h2>
              {error() instanceof NotFound || (error() as { kind?: string }).kind === "not-found"
                ? "Incident not found"
                : "Could not open this page"}
            </h2>
            <p class="not-found">
              {(error() as { kind?: string }).kind ?? "error"}: {(error() as Error).message}
            </p>
            <button onClick={reset}>Try again</button>
            <a href="/overview">Back to overview</a>
          </section>
        )}
      >
        <Loading fallback={<p class="route-loading">Loading page…</p>}>
          <IncidentBody incident={incident()} />
        </Loading>
      </Errored>
    </main>
  );
}

const Router = createRouter({
  routes: defineRoutes([
    defineRoute({ path: ["/", "/overview"], component: Overview }),
    defineRoute({ path: "/incidents/:id", component: IncidentDetail })
  ])
});

export default function App(props: { url?: string }) {
  return (
    <FilterProvider>
      <div class="dashboard">
        <header>
          <h1>Operations desk</h1>
          <a href="/overview">Overview</a>
        </header>
        <FilterBar />
        <Router url={props.url} />
      </div>
    </FilterProvider>
  );
}
