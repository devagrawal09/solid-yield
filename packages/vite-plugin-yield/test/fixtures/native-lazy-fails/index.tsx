import { createMemo, createSignal, lazy } from "solid-js";
const Page = lazy(() => import("./Page"));
export default () => {
  const [n] = createSignal(1);
  const m = createMemo(async () => {
    await new Promise(r => setTimeout(r, 10));
    if (n() < 0) throw new RangeError("negative");
    return n();
  });
  return <Page count={m()} />;
};
