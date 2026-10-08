import { createMemo, Loading } from "solid-js";
import { Content } from "./content";
export async function region(slug) {
  "use server";
  return () => {
    const data = createMemo(async () => {
      if (globalThis.holdContent) await globalThis.holdContent;
      return slug;
    });
    return (
      <Loading fallback="Loading">
        <Content slug={data()} />
      </Loading>
    );
  };
}
