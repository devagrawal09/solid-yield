"use yield";
import { $cleanup, $effect, $event, $signal } from "solid-yield";
export type Filter = "all" | "active" | "completed";
function parseHash(hash: string): Filter {
  if (hash === "#/active") return "active";
  if (hash === "#/completed") return "completed";
  return "all";
}
export function hashFilter() {
  const [filter, setFilter] = $signal<Filter>(parseHash(location.hash));
  const onChange = $event(function () {
    setFilter(parseHash(location.hash));
  });
  $effect(
    function () {},
    function () {
      window.addEventListener("hashchange", onChange);
      $cleanup(() => window.removeEventListener("hashchange", onChange));
    }
  );
  return filter;
}
