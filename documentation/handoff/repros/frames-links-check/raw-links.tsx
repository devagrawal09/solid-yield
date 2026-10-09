import { getOwner, onCleanup, runWithOwner } from "solid-js";
import { createFrame } from "@solidjs/web/frames";

export function RawLinks() {
  const owner = getOwner();
  const html = '<a href="/page/a">A</a><a href="/page/b">B</a>';
  const ordinary = <div innerHTML={html} />;
  const hosted = <div innerHTML={html} />;
  let frame;
  onCleanup(() => frame?.dispose());
  return (
    <>
      <button
        onClick={() => {
          frame ??= createFrame(hosted, {
            adopt: true,
            ownerScope: fn => runWithOwner(owner, fn)
          });
        }}
      >
        Attach
      </button>
      {ordinary}
      {hosted}
    </>
  );
}
