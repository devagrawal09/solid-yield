import { createContext, createSignal, useContext } from "solid-js";
import type { ParentProps } from "solid-js";

async function save(): Promise<void> {}

function createNotice() {
  const [notice, setNotice] = createSignal<string | undefined>(undefined);
  return { notice, setNotice };
}
const Ctx = createContext<ReturnType<typeof createNotice>>();
function Provider(props: ParentProps) {
  const value = createNotice();
  return <Ctx value={value}>{props.children}</Ctx>;
}
function Button() {
  const { notice, setNotice } = useContext(Ctx);
  const submit = async () => {
    setNotice(undefined);
    try {
      await save();
    } catch (err) {
      setNotice("Could not save.");
    }
  };
  return <button onClick={() => submit()}>{notice() ?? "save"}</button>;
}
export function App() {
  return (
    <Provider>
      <Button />
    </Provider>
  );
}
