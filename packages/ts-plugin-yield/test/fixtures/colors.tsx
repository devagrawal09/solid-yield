import { createMemo, createContext, useContext } from "solid-js";
class NotFound extends Error {}
export function DocPage() {
  const title = createMemo(() => { throw new NotFound("missing"); });
  return <p>{title()}</p>;
}
export function PendingCount() {
  const count = createMemo(async () => 1);
  return <p>{count()}</p>;
}
const Identity = createContext<string>();
export function SaveButton() {
  const name = useContext(Identity);
  const value = createMemo(async () => "saved");
  return <button onClick={() => { value(); }}>{name}</button>;
}
