import { Errored, Loading } from "solid-js";
function Page(props: { count: number }) {
  return (
    <Errored fallback={() => <p>failed</p>}>
      <Loading fallback="…">
        <p>{props.count}</p>
      </Loading>
    </Errored>
  );
}
export default Page;
