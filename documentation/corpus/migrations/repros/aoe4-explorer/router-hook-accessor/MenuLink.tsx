import { useMatch } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
// @solidjs/router 2 hooks take accessors; this is the router's own documented form.
export function MenuLink(props: { href: string; children?: JSX.Element }) {
  const isMatch = useMatch(() => props.href);
  return <a href={props.href} class={{ "opacity-70": !isMatch() }}>{props.children}</a>;
}
