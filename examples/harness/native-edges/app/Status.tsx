import { useContext } from "solid-js";
import { FilterContext } from "./filters";
// A context guard inline in a component, before its JSX.
export function Status() {
  const filters = useContext(FilterContext);
  if (!filters) throw new Error("Status needs a provider");
  return <p class="status">range: {filters.range()}</p>;
}
