import { Loading } from "solid-js";
export function App(props: { url: string }) {
  return <Loading on={props.url} fallback={<p>wait</p>}><button onClick={() => { throw new Error("click"); }}>ready</button></Loading>;
}
