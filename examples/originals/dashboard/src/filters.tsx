import { createContext, createSignal, useContext, type Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { Range, Team } from "./api";

export const rangeLabels: Record<Range, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days"
};
export const teamLabels = { all: "All teams", platform: "Platform", support: "Support" };
export type TeamFilter = Team | "all";
interface Filters {
  range: Accessor<Range>;
  team: Accessor<TeamFilter>;
  setRange: (range: Range) => void;
  setTeam: (team: TeamFilter) => void;
}
const FilterContext = createContext<Filters>();

export function FilterProvider(props: { children: JSX.Element }) {
  const [range, setRange] = createSignal<Range>("24h");
  const [team, setTeam] = createSignal<TeamFilter>("all");
  return <FilterContext value={{ range, team, setRange, setTeam }}>{props.children}</FilterContext>;
}

export function useFilters() {
  const value = useContext(FilterContext);
  if (!value) throw new Error("Dashboard filters need a provider");
  return value;
}

export function FilterBar() {
  const filters = useFilters();
  return (
    <section class="filters" aria-label="Dashboard filters">
      <label>
        Date range
        <select
          aria-label="Date range"
          value={filters.range()}
          onChange={e => filters.setRange(e.currentTarget.value as Range)}
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </label>
      <label>
        Team
        <select
          aria-label="Team"
          value={filters.team()}
          onChange={e => filters.setTeam(e.currentTarget.value as TeamFilter)}
        >
          <option value="all">All teams</option>
          <option value="platform">Platform</option>
          <option value="support">Support</option>
        </select>
      </label>
      <p class="filter-description">
        {rangeLabels[filters.range()]} · {teamLabels[filters.team()]}
      </p>
    </section>
  );
}
