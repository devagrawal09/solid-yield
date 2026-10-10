import { createMemo, Loading } from "solid-js";
import { Icon } from "./Icon";
async function loadIcon() {
  return "bug";
}
// A second caller passes a pending (async memo) value to the same prop, inside Loading.
export function Colored() {
  const name = createMemo(() => loadIcon());
  return (
    <Loading>
      <Icon icon={name()} />
    </Loading>
  );
}
