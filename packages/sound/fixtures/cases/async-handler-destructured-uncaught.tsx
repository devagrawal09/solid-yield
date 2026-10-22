import { Errored } from "solid-js";
async function save(text: string | null): Promise<void> {
  if (!text) throw new Error("empty");
}
export function App() {
  return (
    <Errored fallback={() => <p>failed</p>}>
      <button onClick={async ({ currentTarget }) => { await save(currentTarget.textContent); }}>save</button>
    </Errored>
  );
}