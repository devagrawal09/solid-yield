import { createContext, useContext } from "solid-js";
import { h } from "conformance";
const Api = createContext("api");
function useApi() {
  return useContext(Api);
}
function Saver() {
  const api = useApi();
  const [saved, setSaved] = h.signal("saved", "none");
  const save = async () => {
    h.run("save");
    const value = await h.task("save", api);
    h.run("resumed");
    setSaved(value);
  };
  return (
    <button class="save" onClick={save}>
      {saved()}
    </button>
  );
}
export function App() {
  return (
    <Api value="remote">
      <Saver />
    </Api>
  );
}
