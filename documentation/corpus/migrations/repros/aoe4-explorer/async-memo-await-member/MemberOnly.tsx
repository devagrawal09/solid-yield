import { createMemo } from "solid-js";
const SDK = import("./data");
export function MemberOnly() {
  const units = createMemo(async () => (await SDK).units);
  return <main>{units().length}</main>;
}
