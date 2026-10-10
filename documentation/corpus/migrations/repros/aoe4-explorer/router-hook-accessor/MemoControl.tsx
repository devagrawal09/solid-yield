import { useMatch } from "@solidjs/router";
import { createMemo } from "solid-js";
import type { JSX } from "@solidjs/web";
export function MemoControl(props: { href: string; children?: JSX.Element }) {
  const href = createMemo(() => props.href);
  const isMatch = useMatch(href);
  return <a href={props.href} class={{ "opacity-70": !isMatch() }}>{props.children}</a>;
}
