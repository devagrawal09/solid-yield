import { createMemo, Errored } from "solid-js";
class Problem extends Error {}
function fail() {
  throw new Problem("author failure");
}
function Child() {
  const value = createMemo(() => fail());
  return <span>{value()}</span>;
}
export function FailureView() {
  return (
    <Errored
      fallback={error => {
        const caught = error();
        return <p>{caught instanceof Problem ? caught.message : "wrong identity"}</p>;
      }}
    >
      <Child />
    </Errored>
  );
}
