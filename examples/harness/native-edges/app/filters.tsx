import { createContext, createSignal, useContext, type Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
// A context hook with its guard (F-S37), and a setter in a plain function type
// (setRange: the native lowering adapts it with nativeWrite).
interface Filters {
  range: Accessor<string>;
  setRange: (range: string) => void;
}
export const FilterContext = createContext<Filters>();
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
  { value: "7d", label: "Week" },
  { value: "none", label: "Nothing" }
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
