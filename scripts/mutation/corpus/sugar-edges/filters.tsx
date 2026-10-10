import { createContext, createSignal, useContext, type Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
// F-S37, F-S45, nativeWrite: a context hook, its guard, setters in plain types.
interface Filters {
  range: Accessor<string>;
  setRange: (range: string) => void;
}
const FilterContext = createContext<Filters>();
export function FilterProvider(props: { children: JSX.Element }) {
  const [range, setRange] = createSignal("24h");
  return <FilterContext value={{ range, setRange }}>{props.children}</FilterContext>;
}
export function useFilters() {
  const value = useContext(FilterContext);
  if (!value) throw new Error("filters need a provider");
  return value;
}
const RANGES = [
  { value: "24h", label: "Day" },
  { value: "7d", label: "Week" }
];
export function FilterBar() {
  const filters = useFilters();
  return (
    <select value={filters.range()} onChange={e => filters.setRange(e.currentTarget.value)}>
      {RANGES.map(range => (
        <option value={range.value}>{range.label}</option>
      ))}
    </select>
  );
}
