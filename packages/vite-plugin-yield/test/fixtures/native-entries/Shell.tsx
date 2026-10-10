import type { ParentProps } from "solid-js";

export default function Shell(props: ParentProps<{ title: string }>) {
  return (
    <main>
      <h1>{props.title}</h1>
      {props.children}
    </main>
  );
}
